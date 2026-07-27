FROM node:24-alpine AS frontend-build
WORKDIR /src/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

FROM mcr.microsoft.com/dotnet/sdk:10.0-alpine AS backend-build
WORKDIR /src

COPY backend/MealCalendar.Api.csproj backend/
RUN dotnet restore backend/MealCalendar.Api.csproj

COPY backend/ backend/
RUN dotnet publish backend/MealCalendar.Api.csproj \
    --configuration Release \
    --no-restore \
    --output /app/publish \
    /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0-alpine AS runtime
WORKDIR /app

USER root
COPY --from=backend-build --chown=app:app /app/publish/ ./
COPY --from=frontend-build --chown=app:app /src/frontend/dist/ ./wwwroot/
RUN mkdir -p /app/data /app/images \
    && chown -R app:app /app/data /app/images \
    && chmod 0755 /app/data /app/images

ENV ASPNETCORE_HTTP_PORTS=8080 \
    MealImagesPath=/app/images
EXPOSE 8080

USER app
ENTRYPOINT ["dotnet", "MealCalendar.Api.dll"]
