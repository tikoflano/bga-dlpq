FROM mcr.microsoft.com/devcontainers/php:1-8.2-bullseye

# Remove Yarn repo from base image (expired GPG key breaks apt-get update).
# Node/npm are provided by the devcontainer Node feature.
RUN rm -f /etc/apt/sources.list.d/yarn.list /etc/apt/trusted.gpg.d/yarn.gpg 2>/dev/null; \
    apt-get update && \
    apt-get install -y xdg-utils && \
    # Install Google Chrome for Chrome DevTools MCP
    wget -q -O /tmp/google-chrome.deb https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb && \
    apt-get install -y /tmp/google-chrome.deb && \
    rm /tmp/google-chrome.deb && \
    apt-get clean && rm -rf /var/lib/apt/lists/*