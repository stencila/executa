all: format lint cover audit build docs

setup: setup-ts setup-rust
	
setup-ts:
	npm install

setup-rust:
	rustup component add clippy
	cargo install \
		cargo-audit --features=fix
	cargo install \
		cargo-edit \
		cargo-tarpaulin \
		cargo-udeps \
		cargo-watch
	cargo fetch

format:
	npm run format
	cargo fmt

lint:
	npm run lint
	cargo fix && cargo clippy

test:
	npm test
	cargo test

cover:
	npm run test:cover
	cargo tarpaulin --ignore-tests --out Html --output-dir coverage

watch:
	cargo watch -x 'run -- serve --protocol=ws'

audit-ts:
	npm audit fix

audit-rust:
	cargo +nightly udeps
	cargo audit

build:
	npm run build
	cargo build --release && cargo strip

docs:
	npm run docs
	cargo doc
.PHONY: docs

clean:
	npm run clean
	cargo clean

