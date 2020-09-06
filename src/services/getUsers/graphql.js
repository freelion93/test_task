import { oncePerServices, missingService } from "../../common/services/index";

const PREFIX = "";

export default oncePerServices(function (services) {
  const graphqlBuilderSchema = require("../../common/graphql/LevelBuilder.schema");

  const resolvers = require("./resolvers").default(services);

  return async function builder(args) {
    graphqlBuilderSchema.build_options(args);
    const { parentLevelBuilder, typeDefs, builderContext } = args;

    typeDefs.push(`    
      type ${PREFIX}User {
        user_id: Int,
        login: String,
        name: String,
        email: String,
        manager: Boolean,
        blocked: Boolean,
        birthday: String
      }

      input ${PREFIX}theFilter {
        manager: Boolean,
        blocked: Boolean,
        name: String
      }

      type ${PREFIX}authResult {
        result: String
      }

      input ${PREFIX}theCreds {
        login: String,
        pass: String
      }
    `);

    parentLevelBuilder
      .addQuery({
        name: `Users`,
        type: `[${PREFIX}User]`,
        args: `filter: ${PREFIX}theFilter`,
        resolver: resolvers.fetchUsers(builderContext),
      })
      .addMutation({
        name: "Credentials",
        type: `[${PREFIX}authResult]`,
        args: `auth: ${PREFIX}theCreds`,
        resolver: resolvers.checkCredentials(builderContext),
      });
  };
});
