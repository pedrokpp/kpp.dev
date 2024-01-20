package server

import (
	"html/template"

	"github.com/gin-gonic/gin"
)

func GetRouter() *gin.Engine {
	r := gin.Default()

	r.GET("/", func(c *gin.Context) {
		tmpl, _ := template.ParseFiles("./templates/index.html")
		tmpl.Execute(c.Writer, nil)
	})

	return r
}
