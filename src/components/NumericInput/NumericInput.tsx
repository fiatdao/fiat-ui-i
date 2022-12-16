import * as Label from '@radix-ui/react-label';
import React, { ChangeEventHandler, ReactNode } from 'react';
import styles from './NumericInput.module.css';

interface NumericInputProps {
  className?: string;
  style?: Record<string, string>;
  label: ReactNode;
  onChange: ChangeEventHandler<HTMLInputElement>;
  placeholder: string;
  value: string;
}

export const NumericInput = (props: NumericInputProps) => {
  return (
    <div className={`styles.InputField ${props.className}`} style={props.style}>
      <Label.Root className={styles.InputField_Label} htmlFor='input'>
        Underlier to swap
      </Label.Root>
      <div className={styles.InputField_InputContainer}>
        <input
          autoComplete='off'
          autoCorrect='off'
          className={styles.InputField_Input}
          id='underlierToSwap'
          inputMode='decimal'
          maxLength={64}
          onChange={props.onChange}
          pattern='/^\d*\.?\d*$/'
          placeholder={props.placeholder}
          spellCheck={false}
          value={props.value}
        />
        <span className={styles.InputField_RightAdornment}>{props.label}</span>
      </div>
    </div>
  );
};
