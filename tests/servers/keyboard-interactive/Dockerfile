# Use the Debian Bullseye Slim image as the base
FROM debian:bullseye-slim

# Install the necessary packages
RUN apt-get update && \
apt-get install -y --no-install-recommends \
openssh-server htop mc sudo bash bash-completion readline-common && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Configure SSH server
RUN mkdir /var/run/sshd && \
    sed -i 's/^ChallengeResponseAuthentication no/ChallengeResponseAuthentication yes/' /etc/ssh/sshd_config && \
    echo 'PermitRootLogin yes' >> /etc/ssh/sshd_config && \
    echo 'Port 4444' >> /etc/ssh/sshd_config && \
    echo 'UsePAM yes' >> /etc/ssh/sshd_config && \
    echo 'AuthenticationMethods keyboard-interactive' >> /etc/ssh/sshd_config

COPY --chmod=755 orthrus2.sh /etc/profile.d/ascii-art.sh

# Add a test user with a password
RUN useradd -m -s /bin/bash testuser && \
    echo "testuser:testpassword" | chpasswd

COPY --chown=testuser:testuser --chmod=755 color-test.sh /home/testuser/color-test.sh

# Expose port 4444
EXPOSE 4444

# Start the SSH server
CMD ["/usr/sbin/sshd", "-D", "-e"]