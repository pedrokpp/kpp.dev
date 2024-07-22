package handlers

import (
	"github.com/labstack/echo/v4"
	"kpp.dev/components"
)

func MainPage(c echo.Context) error {
	mainPage := components.Welcome("teste")
	return Render(c, 200, mainPage)
}
