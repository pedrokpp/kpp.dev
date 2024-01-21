package server

import (
	"github.com/gin-gonic/gin"
)

func GetRouter() *gin.Engine {
	r := gin.Default()

	r.StaticFile("/", "./public/index.html")
	r.StaticFile("/style.css", "./public/style.css")

	return r
}
