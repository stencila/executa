/*
 * vsocket-server - A server for AF_VSOCK to allow communications
 * between the host and KVM virtual machines.
 *
 * Inspired by and mostly based on `nc-vsock` by Stefan Hajnoczi
 * https://github.com/stefanha/nc-vsock/. This is a simplified
 * version of `nc-vsock` that only listens, does not
 * support tunneling to TCP socket, and does support
 * echoing (mainly for testing).
 *
 * See also https://github.com/firecracker-microvm/firecracker/blob/master/tests/host_tools/vsock_helper.c
 */

#include <errno.h>
#include <stdio.h>
#include <stdlib.h>
#include <stdbool.h>
#include <string.h>
#include <unistd.h>
#include <fcntl.h>
#include <sys/socket.h>
#include <sys/select.h>
#include <linux/vm_sockets.h>

/**
 * Set a file descriptor to be non-blocking
 */
static void set_non_blocking(int fd) {
	int ret = fcntl(fd, F_GETFL);
	if (ret < 0) {
		perror("fcntl");
		return;
	}
	fcntl(fd, F_SETFL, ret & ~O_NONBLOCK);
}

/**
 * Transfer data between file descriptors
 */
static int transfer_data(int in_fd, int out_fd) {
	char buffer[4096];
	char *data = buffer;

	size_t size = read(in_fd, buffer, sizeof(buffer));
	if (size <= 0) return -1;

	ssize_t remaining = size;
	while (remaining > 0) {
		size = write(out_fd, data, remaining);
		if (size < 0 && errno == EAGAIN) {
			size = 0;
		} else if (size <= 0) {
			return -1;
		}

		if (remaining > size) {
			for (;;) {
				fd_set wfds;
				FD_ZERO(&wfds);
				FD_SET(out_fd, &wfds);
				if (select(out_fd + 1, NULL, &wfds, NULL, NULL) < 0) {
					if (errno == EINTR) {
						continue;
					} else {
						perror("select");
						return -1;
					}
				}

				if (FD_ISSET(out_fd, &wfds)) {
					break;
				}
			}
		}

		data += size;
		remaining -= size;
	}
	return 0;
}

int main(int argc, char **argv) {
    if (argc < 2 || argc > 3) {
        fprintf(stderr, "Usage: vsock-server <port> [--echo | --pass]\n");
		return 1;
    }

	char *port_str = argv[1];
	char *end = NULL;
	long port = strtol(port_str, &end, 10);
	if (port_str == end || *end != '\0') {
		fprintf(stderr, "invalid port number: %s\n", port_str);
		return 1;
	}

  enum mode {
		pass,
		echo
	} mode = pass;
	if (argc == 3) {
		char* option = argv[2];
    if (strcmp(option, "--echo") == 0) {
			mode = echo;
		} else if (strcmp(option, "--pass") == 0) {
			mode = pass;
		} else {
			fprintf(stderr, "invalid mode: %s\n", option);
			return 1;
		}
  }

	struct sockaddr_vm sa_listen = {
		.svm_family = AF_VSOCK,
		.svm_cid = VMADDR_CID_ANY,
		.svm_port = port
	};

	int listen_fd = socket(AF_VSOCK, SOCK_STREAM, 0);
	if (listen_fd < 0) {
		perror("socket");
		return 1;
	}

	if (bind(listen_fd, (struct sockaddr*)&sa_listen, sizeof(sa_listen)) != 0) {
		perror("bind");
		close(listen_fd);
		return 1;
	}

	if (listen(listen_fd, 1) != 0) {
		perror("listen");
		close(listen_fd);
		return 1;
	}

	struct sockaddr_vm sa_client;
	socklen_t socklen_client = sizeof(sa_client);

	int client_fd = accept(listen_fd, (struct sockaddr*)&sa_client, &socklen_client);
	if (client_fd < 0) {
		perror("accept");
		close(listen_fd);
		return 1;
	}

	close(listen_fd);

	fd_set rfds;
	int nfds = client_fd + 1;

	set_non_blocking(STDIN_FILENO);
	set_non_blocking(STDOUT_FILENO);
	set_non_blocking(client_fd);

	while (true) {
		FD_ZERO(&rfds);
		FD_SET(STDIN_FILENO, &rfds);
		FD_SET(client_fd, &rfds);

		if (select(nfds, &rfds, NULL, NULL, NULL) < 0) {
			if (errno == EINTR) {
				continue;
			} else {
				perror("select");
				return 1;
			}
		}

		if (FD_ISSET(STDIN_FILENO, &rfds) && port > 0) {
			if (transfer_data(STDIN_FILENO, client_fd) < 0) {
				return 1;
			}
		}

		if (FD_ISSET(client_fd, &rfds)) {
			if (transfer_data(client_fd, mode == echo ? client_fd : STDOUT_FILENO) < 0) {
				return 1;
			}
		}
	}

	return 0;
}
