#!/bin/bash

# Geohashing API Deployment Script
# Usage: ./deploy.sh [production|development|build|stop|logs]

set -e

IMAGE_NAME="geohashing-api"
CONTAINER_NAME="geohashing-api"

case "${1:-production}" in
  "production"|"prod")
    echo "🚀 Deploying Geohashing API in production mode..."
    docker-compose up -d geohashing-api
    echo "✅ Production deployment complete!"
    echo "📍 API available at: http://localhost:3000"
    echo "📖 API docs at: http://localhost:3000/api"
    ;;
    
  "development"|"dev")
    echo "🛠️  Starting Geohashing API in development mode..."
    docker-compose --profile dev up -d geohashing-api-dev
    echo "✅ Development environment started!"
    echo "📍 API available at: http://localhost:3001"
    echo "🔄 Hot reload enabled - edit files and see changes instantly"
    ;;
    
  "build")
    echo "🔨 Building Docker image..."
    docker build -t $IMAGE_NAME .
    echo "✅ Image built successfully: $IMAGE_NAME"
    ;;
    
  "stop")
    echo "🛑 Stopping all services..."
    docker-compose down
    echo "✅ All services stopped"
    ;;
    
  "logs")
    echo "📋 Showing logs..."
    docker-compose logs -f
    ;;
    
  "clean")
    echo "🧹 Cleaning up Docker resources..."
    docker-compose down
    docker rmi $IMAGE_NAME 2>/dev/null || echo "No image to remove"
    docker system prune -f
    echo "✅ Cleanup complete"
    ;;
    
  "status")
    echo "📊 Service status:"
    docker-compose ps
    ;;
    
  "help"|"--help"|"-h")
    echo "Geohashing API Deployment Script"
    echo ""
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  production  Deploy in production mode (default)"
    echo "  development Deploy in development mode with hot reload"
    echo "  build       Build Docker image only"
    echo "  stop        Stop all running services"
    echo "  logs        Show application logs"
    echo "  clean       Stop services and clean up Docker resources"
    echo "  status      Show status of services"
    echo "  help        Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                    # Start in production mode"
    echo "  $0 development        # Start in development mode"
    echo "  $0 logs               # View logs"
    echo "  $0 stop               # Stop all services"
    ;;
    
  *)
    echo "❌ Unknown command: $1"
    echo "Use '$0 help' for usage information"
    exit 1
    ;;
esac 