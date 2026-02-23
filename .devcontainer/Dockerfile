FROM mcr.microsoft.com/devcontainers/php:1-8.2-bookworm

RUN rm -f /etc/apt/sources.list.d/yarn.list && \
    apt-get update && \
    apt-get install -y xdg-utils && \
    wget -q -O /tmp/google-chrome.deb https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb && \
    apt-get install -y /tmp/google-chrome.deb && \
    rm /tmp/google-chrome.deb && \
    apt-get clean && rm -rf /var/lib/apt/lists/*