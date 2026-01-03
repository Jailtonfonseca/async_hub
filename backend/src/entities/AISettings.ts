import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";

export type AIProvider = "openai" | "gemini" | "openrouter";

@Entity("ai_settings")
export class AISettings {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: "varchar", length: 50, unique: true })
    provider!: AIProvider;

    @Column({ type: "varchar", length: 255, nullable: true })
    apiKey?: string;

    @Column({ type: "varchar", length: 100, nullable: true })
    model?: string;

    @Column({ type: "boolean", default: true })
    isEnabled!: boolean;

    @Column({ type: "int", default: 1 })
    priority!: number;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}
