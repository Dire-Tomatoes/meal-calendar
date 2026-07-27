# Runtime base used by Visual Studio fast-mode debugging
FROM mcr.microsoft.com/dotnet/aspnet:10.0-alpine AS base
WORKDIR /app

ENV ASPNETCORE_HTTP_PORTS=8080 \
    MealImagesPath=/app/images
EXPOSE 8080


# Build React frontend
FROM node:24-alpine AS frontend-build
WORKDIR /src/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build


# Build ASP.NET backend
FROM mcr.microsoft.com/dotnet/sdk:10.0-alpine AS backend-build
WORKDIR /src/backend

COPY backend/MealCalendar.Api.csproj ./
RUN dotnet restore MealCalendar.Api.csproj

COPY backend/ ./
RUN dotnet publish MealCalendar.Api.csproj \
    --configuration Release \
    --no-restore \
    --output /app/publish \
    /p:UseAppHost=false


# Final production image
FROM base AS final
WORKDIR /app

USER root

COPY --from=backend-build --chown=app:app /app/publish/ ./
COPY --from=frontend-build --chown=app:app /src/frontend/dist/ ./wwwroot/

RUN mkdir -p /app/data /app/images \
    && chown -R app:app /app/data /app/images \
    && chmod 0755 /app/data /app/images

USER app

ENTRYPOINT ["dotnet", "MealCalendar.Api.dll"]
