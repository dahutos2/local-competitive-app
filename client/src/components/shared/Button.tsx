import React from 'react';
import styles from './Button.module.css';

interface ButtonProps {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    variant?: 'primary' | 'secondary';
    className?: string;
}

const Button: React.FC<ButtonProps> = ({ children, onClick, disabled = false, variant = 'primary', className = '' }) => {
    const classNames = `${styles.btn} ${variant === 'secondary' ? styles.btnSecondary : styles.btnPrimary} ${disabled ? styles.disabled : ''} ${className}`;
    return (
        <button className={classNames} onClick={onClick} disabled={disabled}>
            {children}
        </button>
    );
};

export default Button;
