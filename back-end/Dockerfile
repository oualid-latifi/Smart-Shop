# Image du serveur SmartShop : compilation avec Maven puis exécution sur un Java 17 léger
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn -q -B dependency:go-offline
COPY src ./src
RUN mvn -q -B package -DskipTests

FROM eclipse-temurin:17-jre
WORKDIR /app
# Polices pour les PDF (factures, tickets, étiquettes) et fuseau horaire du Maroc
RUN apt-get update && apt-get install -y --no-install-recommends fontconfig fonts-dejavu-core curl \
    && rm -rf /var/lib/apt/lists/*
ENV TZ=Africa/Casablanca \
    BACKUP_DIR=/data/backups \
    JAVA_OPTS="-XX:MaxRAMPercentage=75"
RUN useradd --system --uid 1001 smartshop && mkdir -p /data/backups && chown -R smartshop /data
COPY --from=build /app/target/*.jar app.jar
USER smartshop
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s CMD curl -fs http://localhost:${PORT:-8080}/actuator/health || exit 1
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar app.jar"]
