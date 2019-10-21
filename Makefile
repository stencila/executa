all: setup lint cover build docs

setup:
	npm install

format:
	npm run format

lint:
	npm run lint

test:
	npm test

cover:
	npm run test:cover

build:
	npm run build

docker:
	docker build --tag stencila/executa .

docs:
	npm run docs
.PHONY: docs

clean:
	npm run clean
