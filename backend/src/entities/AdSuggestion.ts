import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from "typeorm";
import { Product } from "./Product";

export type AdSuggestionType =
    | "classico"
    | "premium"
    | "kit_2"
    | "kit_3"
    | "kit_accessory"
    | "seo_variant";

export type AdSuggestionStatus =
    | "pending"
    | "approved"
    | "rejected"
    | "created";

@Entity("ad_suggestions")
export class AdSuggestion {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    productId!: number;

    @ManyToOne(() => Product, { onDelete: "CASCADE" })
    @JoinColumn({ name: "productId" })
    product!: Product;

    @Column({ type: "varchar", length: 50 })
    type!: AdSuggestionType;

    @Column({ type: "varchar", length: 50, default: "pending" })
    status!: AdSuggestionStatus;

    @Column({ type: "varchar", length: 255 })
    suggestedTitle!: string;

    @Column({ type: "text", nullable: true })
    suggestedDescription?: string;

    @Column({ type: "decimal", precision: 10, scale: 2 })
    suggestedPrice!: number;

    @Column({ type: "text", nullable: true })
    reasoning?: string;

    @Column({ type: "varchar", length: 100, nullable: true })
    targetNiche?: string;

    @Column({ type: "int", default: 1 })
    stockRequired!: number;

    @Column({ type: "varchar", length: 50, nullable: true })
    generatedBy?: string; // Which LLM generated this

    @Column({ type: "varchar", length: 100, nullable: true })
    mlListingId?: string; // ML listing ID after creation

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;

    @Column({ type: "datetime", nullable: true })
    approvedAt?: Date;

    @Column({ type: "datetime", nullable: true })
    createdInMlAt?: Date;
}
