import { useEffect, useState } from "react";

function Header() {

    const [y, setY] = useState(window.scrollY);
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        window.addEventListener("scroll", () => {
            setY(window.scrollY);
        });
        setScrolled(y !== 0);
    }, [y]);

    return (
        <div className={`fixed ${scrolled ? 'header-shadow' : ''} top-0 w-full flex justify-between items-center p-2 pr-10 pl-10 bg-main text-whiteish select-none`}>
            <h1>a</h1>
            <div className="flex justify-center items-center gap-10">
                <p className="hover:underline cursor-pointer">Sobre</p>
                <p className="hover:underline cursor-pointer">Projetos</p>
                <p className="hover:underline cursor-pointer">Contato</p>
            </div>
        </div>
    );
}

export default Header;
