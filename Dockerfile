FROM node:20-bullseye

# Install Python
RUN apt-get update && apt-get install -y python3 python3-pip

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install deps
RUN npm install

# Copy app source
COPY . .

# Expose port
EXPOSE 8080

# Start app
CMD ["npm", "start"]
