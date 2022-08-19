import { useEffect, useState } from 'react';
import { faGithub, faLinkedin } from '@fortawesome/free-brands-svg-icons';
import img from '../../imgs/img.jfif'
import Wave from 'react-wavify'
import Button from '../Button';

function Sobre() {

    const [greeting, setGreeting] = useState("Bom dia");
    
    useEffect(() => {
        let date = new Date()
        if (date.getHours() < 12) {
            setGreeting("Bom dia")
        } else if (date.getHours() < 18) {
            setGreeting("Boa tarde")
        } else {
            setGreeting("Boa noite")
        }
    }, []);


    return (
        <>
            <div className="flex justify-center items-center gap-24 bg-main p-60">
                <img src={img} alt="foto de perfil" className="rounded-full shadow-xl" height={200} width={200}/>
                <div className="flex flex-col justify-center items-start text-whiteish gap-4">
                    <p className="text-2xl text-yellowish">{greeting}!</p>
                    <p>Lorem ipsum dolor, sit amet consectetur adipisicing elit.</p>
                    <div className="w-full flex justify-center items-center gap-10">
                        <Button text="GitHub" icon={faGithub}/>
                        <Button text="Linkedin" icon={faLinkedin} />
                    </div>
                </div>

            </div>
            <Wave fill='#393E46' className="bg-main overflow-hidden"
                paused={false}
                options={{
                    height: 1,
                    amplitude: 20,
                    speed: 0.15,
                    points: 4
                }}
            />
        </>
    );
}

export default Sobre;
