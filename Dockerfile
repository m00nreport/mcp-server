# Builds the server so a directory or an inspector can start it and ask what it
# offers. No credentials are baked in and none are needed: started with neither
# M00N_API_URL nor M00N_API_KEY, the server runs in preview mode, answers the
# listings from preview-snapshot.json, and refuses every call.
#
# To use it for real, pass both variables:
#   docker run -i --rm -e M00N_API_URL=https://m00nreport.com -e M00N_API_KEY=m00n_mcp_... <image>

FROM node:22-alpine AS build

WORKDIR /app

# Dependencies first, so a source-only change does not reinstall them.
COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY bin ./bin
COPY preview-snapshot.json ./
COPY README.md LICENSE ./

# node:22-alpine ships a uid 1000 "node" user. Nothing here writes to disk, so no
# chown is needed. This image exists for third parties to build and run, and the
# directories that score containers are the audience that checks.
USER node

# stdio transport: the protocol is stdout, logs are stderr. Nothing listens on a
# port, so there is nothing to EXPOSE.
ENTRYPOINT ["node", "bin/m00n-mcp.js"]
