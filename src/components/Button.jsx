import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

function Button({icon, text, onClick, color = "whiteish", bg = "main"}) {
    return (
        <div onClick={onClick} 
            className={`cursor-pointer flex justify-center items-center gap-2 p-1.5 bg-${bg} text-${color} border border-${color} rounded-md 
                hover:bg-${color} hover:text-${bg} hover:border-${bg}`}>
            <FontAwesomeIcon icon={icon}/>
            <p>{text}</p>
        </div>
    );
}

export default Button;
