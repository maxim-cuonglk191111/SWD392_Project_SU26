# =========================================================
# LUCY — All-in-One Container
#
#   nginx :8080  →  React static files (SPA)
#               →  proxy /api/*    → backend :5000
#               →  proxy /socket.io/* → backend :5000
#
#   node  :5000  →  Express REST API + Socket.IO
# =========================================================

# ── Backend ─────────────────────────────────────────────
FROM node:20-alpine AS backend
WORKDIR /app
COPY backend/package*.json ./
RUN npm install --omit=dev
COPY backend/ .
EXPOSE 5000
CMD ["node", "server.js"]

# ── Identity Service ──────────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS identity-build
WORKDIR /src
COPY ["services/identity-service/identity-service.csproj", "./"]
RUN dotnet restore "identity-service.csproj"
COPY services/identity-service/ .
RUN dotnet build "identity-service.csproj" -c Release -o /app/build

FROM identity-build AS identity-publish
RUN dotnet publish "identity-service.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0-alpine AS identity-service
WORKDIR /app/identity
COPY --from=identity-publish /app/publish .
ENV ASPNETCORE_URLS=http://+:5064
EXPOSE 5064
ENTRYPOINT ["dotnet", "identity-service.dll"]

# ── LMS Service ───────────────────────────────────────────
FROM maven:3.9.6-eclipse-temurin-21-alpine AS lms-build
WORKDIR /app
COPY services/lms-service/pom.xml .
RUN mvn dependency:go-offline
COPY services/lms-service/src ./src
COPY Document ./Document
RUN mvn package -DskipTests

FROM eclipse-temurin:21-jre-alpine AS lms-service
WORKDIR /app/lms
COPY --from=lms-build /app/target/demo-0.0.1-SNAPSHOT.jar app.jar
COPY --from=lms-build /app/Document ./Document
EXPOSE 8081
ENTRYPOINT ["java", "-jar", "app.jar"]

# ── Frontend ──────────────────────────────────────────────
FROM node:20-alpine AS frontend-build
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
ARG VITE_BACKEND_URL=
ARG VITE_IDENTITY_URL=
ARG VITE_AGORA_APP_ID
ENV VITE_BACKEND_URL=$VITE_BACKEND_URL
ENV VITE_IDENTITY_URL=$VITE_IDENTITY_URL
ENV VITE_AGORA_APP_ID=$VITE_AGORA_APP_ID
RUN npm run build

# ── Monolit Final ────────────────────────────────────────
FROM nginx:alpine AS monolit

# Cài đặt bash, supervisor, wget, nodejs, và các thư viện hệ thống cần cho .NET / Java
RUN apk add --no-cache bash supervisor wget nodejs icu-libs krb5-libs libgcc libintl libstdc++ zlib && \
    mkdir -p /var/log/supervisor /var/run

# Copy .NET 10 Runtime từ identity-service (alpine-based)
COPY --from=identity-service /usr/share/dotnet /usr/share/dotnet
RUN ln -s /usr/share/dotnet/dotnet /usr/bin/dotnet

# Copy Java 21 JRE từ lms-service (alpine-based)
COPY --from=lms-service /opt/java/openjdk /opt/java/openjdk
ENV JAVA_HOME=/opt/java/openjdk
ENV PATH="${PATH}:${JAVA_HOME}/bin"

# Copy React SPA build
COPY --from=frontend-build /app/dist /usr/share/nginx/html

# Copy backend Node.js app
COPY --from=backend /app /app

# Copy .NET Identity Service
COPY --from=identity-service /app/identity /app/identity

# Copy Java LMS Service
COPY --from=lms-service /app/lms /app/lms

# Copy nginx config — serves SPA + proxies /api/* → upstream services
COPY nginx.conf.monolit /etc/nginx/nginx.conf

# Copy supervisord config — chạy nginx + backend node + identity + lms
COPY supervisord.conf /etc/supervisord.conf

# nginx lắng nghe port 8080 (tất cả inbound)
EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:8080/api/health || exit 1

CMD ["supervisord", "-c", "/etc/supervisord.conf"]
