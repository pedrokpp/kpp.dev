import { useEffect, useState } from 'react';
import { faGithub, faLinkedin } from '@fortawesome/free-brands-svg-icons';
import { faFile } from '@fortawesome/free-regular-svg-icons';
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
        <div className="flex flex-col m-0 p-0 absolute top-0 bottom-0 h-full w-full">
            <div className="flex justify-center items-center gap-24 bg-main p-64 h-full">
                <img src={img} alt="foto de perfil" className="rounded-full shadow-xl" height={200} width={200}/>
                <div className="flex flex-col justify-center items-start text-whiteish gap-4">
                    <p className="text-2xl text-yellowish">{greeting}!</p>
                    <p>Clique em um botão para saber mais sobre mim</p>
                    <div className="w-full flex justify-center items-center gap-10">
                        <Button onClick={() => window.open('https://github.com/pedrokpp/', '_blank')} text="GitHub" icon={faGithub}/>
                        <Button onClick={() => window.open('https://www.linkedin.com/in/pedrokp/', '_blank')} text="Linkedin" icon={faLinkedin} />
                        <Button onClick={() => window.open(process.env.PUBLIC_URL + '/Pedro_Kozlowski_CV.pdf', '_blank')} text="Currículo" icon={faFile} />
                    </div>
                </div>
            </div>
            <Wave fill='#393E46' className="bg-main overflow-hidden"
                paused={false}
                options={{
                    height: 20,
                    amplitude: 20,
                    speed: 0.2,
                    points: 6
                }}
            />
        </div>
    );
}

export default Sobre;
