import { DataTypes, Model } from "sequelize";
import { sequelize } from "./index.js";
export class Group extends Model {
    id;
    name;
    user_id;
    created_at;
    updated_at;
}
Group.init({
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    name: {
        type: DataTypes.STRING,
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
}, {
    sequelize,
    tableName: "groups",
    indexes: [
        {
            fields: ["user_id"],
        },
    ],
    timestamps: true,
    underscored: true,
});
//# sourceMappingURL=ypGroup.js.map