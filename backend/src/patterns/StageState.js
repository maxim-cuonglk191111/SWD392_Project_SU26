const EventEmitter = require('events');

class RoomContext extends EventEmitter {
    constructor(roomId, totalStages = 6) {
        super();
        this.roomId = roomId;
        this.totalStages = totalStages;
        this.currentStageIndex = 1;
        this.timer = null;
        this.timeLeft = 900; // 15 minutes in seconds
        
        // Initialize the first state
        this.changeState(new StageState(this, 1));
    }

    changeState(newState) {
        if (this.timer) {
            clearInterval(this.timer);
        }
        
        this.currentState = newState;
        this.currentStageIndex = newState.stageIndex;
        this.timeLeft = newState.getDuration();
        
        // Observer pattern: notify all listeners (socket.io) that stage has changed
        this.emit('stage-changed', {
            stage: this.currentStageIndex,
            timeLeft: this.timeLeft,
            topic: newState.getTopic()
        });

        this.startTimer();
    }

    startTimer() {
        this.timer = setInterval(() => {
            this.timeLeft -= 1;
            
            // Observer pattern: notify time update
            this.emit('timer-update', {
                stage: this.currentStageIndex,
                timeLeft: this.timeLeft
            });

            if (this.timeLeft <= 0) {
                this.currentState.handleTimeOut();
            }
        }, 1000); // Trigger every second
    }

    stop() {
        if (this.timer) {
            clearInterval(this.timer);
        }
    }
}

// Base State interface
class State {
    constructor(context, stageIndex) {
        this.context = context;
        this.stageIndex = stageIndex;
    }
    
    getDuration() {
        return 600; // 10 minutes default
    }

    getTopic() {
        return "Topic " + this.stageIndex;
    }

    handleTimeOut() {
        throw new Error("handleTimeOut must be implemented");
    }
}

// Concrete State
class StageState extends State {
    constructor(context, stageIndex) {
        super(context, stageIndex);
        
        // For testing purposes, we can make the stages short so it's easy to verify
        this.isTestMode = process.env.NODE_ENV !== 'production';
    }

    getDuration() {
        // In real world: 600 seconds (10 minutes)
        // For testing: 10 seconds per stage to quickly see it switch
        return this.isTestMode ? 10 : 600; 
    }

    getTopic() {
        const topics = [
            "Introductions & Ice Breaker",
            "General Discussion",
            "Deep Dive: Architecture",
            "Debate & QA",
            "Casual Talk",
            "Closing & Feedback"
        ];
        return topics[this.stageIndex - 1] || `Stage ${this.stageIndex} Topic`;
    }

    handleTimeOut() {
        console.log(`[Room ${this.context.roomId}] Stage ${this.stageIndex} Timeout!`);
        
        if (this.stageIndex < this.context.totalStages) {
            // Transition to next state
            this.context.changeState(new StageState(this.context, this.stageIndex + 1));
        } else {
            // Room finished
            this.context.emit('room-finished', { roomId: this.context.roomId });
            this.context.stop();
        }
    }
}

module.exports = { RoomContext, StageState };
