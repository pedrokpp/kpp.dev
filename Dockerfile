FROM golang:1.22.5

WORKDIR /src
COPY . .

RUN go build -o ./website ./cmd/website/

EXPOSE 8080

ENTRYPOINT ["./website"]
