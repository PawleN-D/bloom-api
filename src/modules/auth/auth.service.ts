import bcrypt from 'bcryptjs';
import { prisma } from '../../shared/database/prisma';
import { UserRole } from '@prisma/client';


interface RegisterUserInput {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role: UserRole;
}

export class AuthService {
    async registerUser(data: RegisterUserInput) {
        const existingUser = await prisma.user.findUnique({
            where: { email: data.email },
        });

        if (existingUser) {
            throw new Error('Email already exists');
        }

        const hashedPassword = await bcrypt.hash(data.password, 10);
        const user = await prisma.user.create({
            data: {
                email: data.email,
                password: hashedPassword,
                firstName: data.firstName,
                lastName: data.lastName,
                role: data.role
            }
        });

        return user;
    }
}