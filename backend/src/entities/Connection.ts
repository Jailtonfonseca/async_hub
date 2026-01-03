import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";

@Entity("connections")
export class Connection {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ unique: true })
    marketplace!: string; // 'woocommerce', 'mercadolibre', etc.

    @Column({ nullable: true })
    apiUrl?: string;

    @Column({ nullable: true })
    apiKey?: string;

    @Column({ nullable: true })
    apiSecret?: string;

    @Column({ nullable: true })
    accessToken?: string;

    @Column({ nullable: true })
    refreshToken?: string;

    @Column({ nullable: true })
    userId?: string;

    @Column({ default: false })
    isConnected!: boolean;

    @Column({ type: "datetime", nullable: true })
    tokenExpiresAt?: Date;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}
