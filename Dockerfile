# Serves the built site. The build itself happens before this: either
# `npm run build` locally, or by unpacking the site archive from a release, so
# what gets deployed is byte-for-byte what was released rather than a rebuild.
FROM nginxinc/nginx-unprivileged:1.29-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY dist/ /usr/share/nginx/html/

EXPOSE 8080
