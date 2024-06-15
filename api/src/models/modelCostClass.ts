import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "./sequelize.js";

interface PsModelCostClassCreationAttributes
  extends Optional<
    PsModelCostClassAttributes,
    "id" | "uuid" | "created_at" | "updated_at"
  > {}

export class PsModelCostClass
  extends Model<PsModelCostClassAttributes, PsModelCostClassCreationAttributes>
  implements PsModelCostClassAttributes
{
  public id!: number;
  public uuid!: string;
  public user_id!: number;
  public created_at!: Date;
  public updated_at!: Date;
  public model_id!: string;
  public configuration!: PsBaseModelCostConfiguration;
}

PsModelCostClass.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    uuid: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    model_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    configuration: {
      type: DataTypes.JSONB,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: "ps_model_cost_classes",
    indexes: [
      {
        fields: ["uuid"],
      },
      {
        fields: ["user_id"],
      },
      {
        fields: ["model_id"],
      },
    ],
    timestamps: true,
    underscored: true,
  }
);