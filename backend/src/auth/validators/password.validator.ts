import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
  registerDecorator,
  ValidationOptions,
} from 'class-validator';

@ValidatorConstraint({ name: 'isStrongPassword', async: false })
export class IsStrongPasswordConstraint implements ValidatorConstraintInterface {
  validate(password: string, args: ValidationArguments): boolean {
    if (!password) return false;
    
    // Minimum 8 characters, maximum 128 characters
    if (password.length < 8 || password.length > 128) {
      return false;
    }
    
    // Must contain at least one uppercase letter
    if (!/[A-Z]/.test(password)) {
      return false;
    }
    
    // Must contain at least one lowercase letter
    if (!/[a-z]/.test(password)) {
      return false;
    }
    
    // Must contain at least one number
    if (!/[0-9]/.test(password)) {
      return false;
    }
    
    // Optional: Must contain at least one special character (recommended but not required)
    // Uncomment if you want to require special characters:
    // if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    //   return false;
    // }
    
    return true;
  }

  defaultMessage(args: ValidationArguments): string {
    return 'Password must be 8-128 characters with at least one uppercase letter, one lowercase letter, and one number';
  }
}

export function IsStrongPassword(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsStrongPasswordConstraint,
    });
  };
}

