FROM node:24-alpine

ENV NODE_ENV=production \
    PORT=3000
WORKDIR /app

# No third-party runtime dependencies are needed.
COPY --chown=node:node package.json server.js index.html app.js styles.css ./

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
