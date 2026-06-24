# =========================================================
# TARGET: backend
# =========================================================
FROM node:20-alpine AS backend
WORKDIR /app
COPY backend/package*.json ./
RUN npm install --omit=dev
COPY backend/ .
EXPOSE 5000
CMD ["node", "server.js"]


# =========================================================
# TARGET: identity-service
# =========================================================
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS identity-build
WORKDIR /src
COPY ["services/identity-service/identity-service.csproj", "./"]
RUN dotnet restore "identity-service.csproj"
COPY services/identity-service/ .
RUN dotnet build "identity-service.csproj" -c Release -o /app/build

FROM identity-build AS identity-publish
RUN dotnet publish "identity-service.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS identity-service
WORKDIR /app
COPY --from=identity-publish /app/publish .
ENV ASPNETCORE_URLS=http://+:5064
EXPOSE 5064
ENTRYPOINT ["dotnet", "identity-service.dll"]


# =========================================================
# TARGET: lms-service
# =========================================================
FROM maven:3.9.6-eclipse-temurin-21-alpine AS lms-build
WORKDIR /app
COPY services/lms-service/pom.xml .
RUN mvn dependency:go-offline
COPY services/lms-service/src ./src
COPY Document ./Document
RUN mvn package -DskipTests

FROM eclipse-temurin:21-jre-alpine AS lms-service
WORKDIR /app
COPY --from=lms-build /app/target/demo-0.0.1-SNAPSHOT.jar app.jar
COPY --from=lms-build /app/Document ./Document
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]


# =========================================================
# TARGET: frontend (Placed at the end to build by default on Render)
# =========================================================
FROM node:20-alpine AS frontend-build
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .

# Declare environment variables as build arguments
ARG VITE_BACKEND_URL
ARG VITE_IDENTITY_URL
ARG VITE_AGORA_APP_ID

# Set environment variables for Vite to build with
ENV VITE_BACKEND_URL=$VITE_BACKEND_URL
ENV VITE_IDENTITY_URL=$VITE_IDENTITY_URL
ENV VITE_AGORA_APP_ID=$VITE_AGORA_APP_ID

RUN npm run build

FROM nginx:alpine AS frontend
COPY --from=frontend-build /app/dist /usr/share/nginx/html
COPY frontend/nginx.conf.template /etc/nginx/templates/default.conf.template
# BACKEND_URL: set per environment (see README section "Environment Variables")
#   Local Docker:  http://backend:5000
#   Render:        https://lucy-backend.onrender.com  (backend service HTTPS URL)
ENV BACKEND_URL=http://backend:5000
ENV NGINX_ENVSUBST_FILTER=BACKEND_URL
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
