# Production image for Cloud Run (apt.dsoom.com).
# Built from a clean Linux checkout, so no locally installed (e.g. Windows) node_modules leak in.

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim
# The start script appends an intermediate CA to the system bundle at
# /etc/ssl/certs/ca-certificates.crt (needed for dynamice.busan.go.kr).
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates poppler-utils tesseract-ocr tesseract-ocr-kor tesseract-ocr-eng python3 python3-venv \
  && rm -rf /var/lib/apt/lists/*
RUN python3 -m venv /opt/hwp && /opt/hwp/bin/pip install --no-cache-dir pyhwp==0.1b15 six==1.17.0 lxml==6.0.2
ENV PATH="/opt/hwp/bin:${PATH}"
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/public ./public
COPY --from=build /app/src/tests/fixtures/documents ./src/tests/fixtures/documents
RUN hwp5txt src/tests/fixtures/documents/compat-sample-5017.hwp > /tmp/hwp-selftest.txt && node -e "const s=require('fs').readFileSync('/tmp/hwp-selftest.txt','utf8').replace(/<(?:그림|표|개체)>/g,'').replace(/\\s/g,'');if(s.length<25)process.exit(1)" && pdftotext src/tests/fixtures/documents/association-1.pdf /tmp/pdf-selftest.txt && test -s /tmp/pdf-selftest.txt && tesseract --list-langs 2>&1 | grep -q kor
USER node
EXPOSE 8080
CMD ["npm", "start"]
