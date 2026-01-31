import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";

@Entity("products")
export class Product {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ unique: true })
    sku!: string;

    @Column()
    title!: string;

    @Column({ type: "text", nullable: true })
    description?: string;

    @Column({ type: "decimal", precision: 10, scale: 2 })
    price!: number;

    @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
    salePrice?: number;

    @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
    costPrice?: number;

    @Column({ nullable: true })
    groupId?: string; // User-defined group ID to link multiple ads to same physical product

    @Column({ nullable: true })
    listingType?: string; // 'classic', 'premium', 'gold_special', etc.

    @Column({ default: 0 })
    stock!: number;

    @Column({ type: "simple-json", nullable: true })
    images?: string[];

    @Column({ nullable: true })
    category?: string;

    @Column({ nullable: true })
    brand?: string;

    @Column({ default: "new" })
    condition!: string;

    @Column({ type: "decimal", precision: 8, scale: 2, nullable: true })
    weight?: number;

    @Column({ type: "simple-json", nullable: true })
    dimensions?: { height: number; width: number; length: number };

    @Column({ type: "simple-json", nullable: true })
    attributes?: Record<string, string>;

    @Column({ default: "active" })
    status!: string;

    // Marketplace External IDs
    @Column({ nullable: true })
    woocommerceId?: string;

    @Column({ nullable: true })
    mercadoLibreId?: string;

    @Column({ nullable: true })
    amazonId?: string;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;

    @Column({ type: "datetime", nullable: true })
    lastSyncedAt?: Date;
}
