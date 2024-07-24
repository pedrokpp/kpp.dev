package api

import (
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"kpp.dev/internal/api/handlers"
)

func New() *echo.Echo {
	e := echo.New()

	e.Use(middleware.Logger())
	e.Use(middleware.Recover())

	s := e.Group("/static")
	s.Use(middleware.StaticWithConfig(middleware.StaticConfig{
		Root:       "./static",
		Browse:     false,
		IgnoreBase: true,
	}))
	e.GET("/", handlers.MainPage)

	return e
}
