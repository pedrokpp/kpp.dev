package main

import "kpp.dev/internal/server"

func main() {
	router := server.GetRouter()
	router.Run(":8080")
}
