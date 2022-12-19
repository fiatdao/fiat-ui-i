import * as Label from '@radix-ui/react-label';
import React, { ChangeEventHandler, ReactNode } from 'react';
import styles from './NumericInput.module.css';

interface NumericInputProps extends React.InputHTMLAttributes<HTMLInputElement>{
  onChange: ChangeEventHandler<HTMLInputElement>;
  label: ReactNode;
  rightAdornment: ReactNode;
}

export const NumericInput = (props: NumericInputProps) => {
  return (
    <div className={`styles.InputField ${props.className}`} style={props.style}>
      <Label.Root className={styles.InputField_Label} htmlFor='input'>
        {props.label}
      </Label.Root>
      <div className={styles.InputField_InputContainer}>
        <input
          autoComplete='off'
          autoCorrect='off'
          className={styles.InputField_Input}
          id='underlierToSwap'
          inputMode='decimal'
          maxLength={18} // arbitrary cutoff to keep inputs from getting too long
          onChange={(event) => {
            const value = event.target.value;
            // {0,4} limits the digits to the right of the decimal to 4 places
            const inputRegex = /^\d+\.?\d{0,4}$/;
            if (value === '' || inputRegex.test(value)) {
              props?.onChange(event);
            }
          }}
          pattern={'^\d+\.?\d{0,4}$'}
          placeholder={props.placeholder || '0'}
          type="text"
          spellCheck={false}
          value={props.value}
        />
        <span className={styles.InputField_RightAdornment}>{props.rightAdornment}</span>
      </div>
    </div>
  );
};
