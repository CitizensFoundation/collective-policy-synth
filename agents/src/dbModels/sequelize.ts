import { Sequelize } from "sequelize";
import pg from "pg";
import safe from "colors";

const logQuery = (query: any, options: any) => {
  console.log(safe.bgGreen(new Date().toLocaleString()));
  console.log(safe.bgYellow(options.bind));
  console.log(safe.bgBlue(query));
  return options;
};

const sequelize = new Sequelize(
  process.env.PSQL_DB_NAME!,
  process.env.PSQL_DB_USER!,
  process.env.PSQL_DB_PASS!,
  {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT!, 10) || 5432,
    dialect: "postgres",
    define: {
      underscored: true,
    },
    dialectModule: pg,
    dialectOptions: {
      ssl: {
        require: false,
        rejectUnauthorized: false,
      },
    },
    logging: process.env.NODE_ENV !== "production" ? logQuery : false,
  }
);

const connectToDatabase = async () => {
  try {
    await sequelize.authenticate();
    console.log("Connection to the database has been established successfully.");
    //await sequelize.sync(); // Sync all models
    console.log("All models were synchronized successfully.");
  } catch (error) {
    console.error("Unable to connect to the database:", error);
    process.exit(1); // Exit the process with failure
  }
};

export { sequelize, connectToDatabase };
