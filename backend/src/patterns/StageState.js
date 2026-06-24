const EventEmitter = require('events');
const axios = require('axios');
const { generateRtcToken } = require('../agoraToken');

const MAX_ACTIVE_SPEAKERS = 2;

class RoomContext extends EventEmitter {
    constructor(roomId, totalStages = 6) {
        super();
        this.roomId = roomId;
        this.maxParticipants = 50;

        const parts = roomId.split('-');
        this.language = parts[0] || 'english';
        this.level = parseInt(parts[1]) || 1;

        this.totalStages = totalStages;
        this.currentStageIndex = 1;
        this.timer = null;
        this.timeLeft = 900;
        this.handRaiseQueue = [];
        this.pinnedDocument = null;
        this.materials = [];
        this.gifts = [];
        this.leaderboard = {};

        // ─── Speaking room state ───────────────────────────────────────────
        // Người đang lên sóng: socketId → true
        this.activeSpeakers = {};
        // Mỗi uid chỉ có 1 socket, tracking theo socketId
        this.participants = {}; // socketId → { name, role }

        this.changeState(new StageState(this, 1));
    }

    // ─── Speaking Room: Kiểm tra trước khi vào phòng ─────────────────────
    preflightCheck() {
        const count = Object.keys(this.participants).length;
        return {
            roomId: this.roomId,
            participants: count,
            maxParticipants: this.maxParticipants,
            available: count < this.maxParticipants,
            latency: Math.floor(Math.random() * 80 + 10), // ms (sẽ override bằng thực tế từ client)
        };
    }

    // ─── Speaking Room: Mentor duyệt người phát biểu ─────────────────────
    approveSpeaker(socketId) {
        const activeCount = Object.keys(this.activeSpeakers).length;
        if (activeCount >= MAX_ACTIVE_SPEAKERS) {
            return { success: false, reason: `Tối đa ${MAX_ACTIVE_SPEAKERS} người phát biểu cùng lúc.` };
        }
        if (!this.participants[socketId]) {
            return { success: false, reason: 'Người dùng không trong phòng.' };
        }
        this.activeSpeakers[socketId] = true;

        const uid = this.getUidFromSocketId(socketId);
        let publisherToken;
        try {
            publisherToken = generateRtcToken(this.roomId, uid, 'publisher');
        } catch {
            publisherToken = null;
        }

        return { success: true, token: publisherToken };
    }

    // ─── Speaking Room: Thu hồi mic ─────────────────────────────────────────
    revokeSpeaker(socketId) {
        if (this.activeSpeakers[socketId]) {
            delete this.activeSpeakers[socketId];
            return true;
        }
        return false;
    }

    // ─── Speaking Room: Chuyển role token (gửi kèm event) ─────────────────
    switchRole(socketId, newRole) {
        const uid = this.getUidFromSocketId(socketId);
        if (!uid) return null;
        try {
            return generateRtcToken(this.roomId, uid, newRole);
        } catch {
            return null;
        }
    }

    getUidFromSocketId(socketId) {
        const p = this.participants[socketId];
        return p ? p.uid : null;
    }

    addParticipant(socketId, name, role, uid) {
        this.participants[socketId] = { name, role, uid };
    }

    removeParticipant(socketId) {
        delete this.participants[socketId];
        delete this.activeSpeakers[socketId];
        this.lowerHand(socketId);
    }

    // ─── Hand raise ─────────────────────────────────────────────────────────
    raiseHand(socketId) {
        if (!this.handRaiseQueue.includes(socketId)) {
            this.handRaiseQueue.push(socketId);
            this.emit('hand-raise-updated', this.handRaiseQueue);
        }
    }

    lowerHand(socketId) {
        const index = this.handRaiseQueue.indexOf(socketId);
        if (index > -1) {
            this.handRaiseQueue.splice(index, 1);
            this.emit('hand-raise-updated', this.handRaiseQueue);
        }
    }

    approveHand(socketId) {
        this.lowerHand(socketId);
        this.emit('hand-approved', socketId);
    }

    // ─── Documents & Materials ───────────────────────────────────────────────
    pinDocument(docUrl) {
        this.pinnedDocument = docUrl;
        this.emit('document-pinned', docUrl);
    }

    addMaterial(material) {
        if (!this.materials) this.materials = [];
        this.materials.push(material);
        this.emit('materials-updated', this.materials);
    }

    removeMaterial(materialId) {
        if (!this.materials) return null;
        const index = this.materials.findIndex(m => m.id === materialId);
        if (index > -1) {
            const material = this.materials[index];
            this.materials.splice(index, 1);
            this.emit('materials-updated', this.materials);
            return material;
        }
        return null;
    }

    // ─── Gifts ─────────────────────────────────────────────────────────────
    sendGift(fromUser, giftName, coins) {
        const giftEvent = {
            id: Date.now() + Math.random().toString(36).substr(2, 5),
            from: fromUser.name,
            giftName,
            coins,
            timestamp: new Date()
        };
        this.gifts.push(giftEvent);
        this.leaderboard[fromUser.name] = (this.leaderboard[fromUser.name] || 0) + coins;
        this.emit('gift-sent', { gift: giftEvent, leaderboard: this.leaderboard });
    }

    // ─── Syllabus ───────────────────────────────────────────────────────────
    updateSyllabus(customStages) {
        this.customStages = customStages;
        const newTopic = customStages[this.currentStageIndex];
        if (newTopic) {
            this.currentState.topic = newTopic;
            this.emit('stage-changed', {
                stage: this.currentStageIndex,
                timeLeft: this.timeLeft,
                topic: newTopic
            });
        }
    }

    // ─── Stage management ───────────────────────────────────────────────────
    changeState(newState) {
        if (this.timer) clearInterval(this.timer);

        newState.getTopic().then(topic => {
            newState.topic = topic;
            this.currentState = newState;
            this.currentStageIndex = newState.stageIndex;
            this.timeLeft = newState.getDuration();

            this.emit('stage-changed', {
                stage: this.currentStageIndex,
                timeLeft: this.timeLeft,
                topic: newState.topic
            });

            this.startTimer();
        }).catch(err => {
            console.error("Failed to fetch topic from Java LMS:", err.message);
        });
    }

    startTimer() {
        this.timer = setInterval(() => {
            this.timeLeft -= 1;
            this.emit('timer-update', {
                stage: this.currentStageIndex,
                timeLeft: this.timeLeft
            });
            if (this.timeLeft <= 0) {
                this.currentState.handleTimeOut();
            }
        }, 1000);
    }

    stop() {
        if (this.timer) clearInterval(this.timer);
    }
}

// Base State
class State {
    constructor(context, stageIndex) {
        this.context = context;
        this.stageIndex = stageIndex;
    }

    getDuration() { return 600; }

    async getTopic() { return "Topic " + this.stageIndex; }

    handleTimeOut() { throw new Error("handleTimeOut must be implemented"); }
}

// Concrete State
class StageState extends State {
    constructor(context, stageIndex) {
        super(context, stageIndex);
        this.isTestMode = process.env.NODE_ENV !== 'production';
    }

    getDuration() {
        return this.isTestMode ? 10 : 600;
    }

    async getTopic() {
        if (this.context.customStages && this.context.customStages[this.stageIndex]) {
            return this.context.customStages[this.stageIndex];
        }
        try {
            const lmsUrl = process.env.LMS_SERVICE_URL || 'http://localhost:8080';
            const response = await axios.get(`${lmsUrl}/api/syllabus/current-question`, {
                params: {
                    language: this.context.language,
                    level: this.context.level,
                    stage: this.stageIndex
                }
            });
            console.log(`[LMS] Stage ${this.stageIndex} topic: ${response.data.topic}`);
            return response.data.topic;
        } catch (error) {
            console.error("[LMS] Error:", error.message);
            return `Stage ${this.stageIndex} Topic (Fallback)`;
        }
    }

    handleTimeOut() {
        console.log(`[Room ${this.context.roomId}] Stage ${this.stageIndex} Timeout!`);
        if (this.stageIndex < this.context.totalStages) {
            this.context.changeState(new StageState(this.context, this.stageIndex + 1));
        } else {
            this.context.emit('room-finished', { roomId: this.context.roomId });
            this.context.stop();
        }
    }
}

module.exports = { RoomContext, StageState, MAX_ACTIVE_SPEAKERS };
