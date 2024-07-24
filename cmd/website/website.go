package main

import "kpp.dev/internal/api"

func main() {
	e := api.New()
	e.Logger.Fatal(e.Start(":8080"))
}
