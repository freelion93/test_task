import moment from "moment";
import crypto from "crypto";
import { oncePerServices, missingService } from "../../common/services/index";
import { filter } from "bluebird";

function apolloToRelayResolverAdapter(oldResolver) {
  return function (obj, args, context) {
    return oldResolver(args, context.request);
  };
}

export default oncePerServices(function (services) {
  const { postgres = missingService("postgres") } = services;

  //делаем запрос к БД по пользователям
  function fetchUsers(builderContext) {
    return async function (obj, args, context) {
      //запрашиваемые поля в задании 1.
      const reqFields =
        "user_id, login,name, email, manager, blocked, data->>'birthday' as birthday";

      //проверяем наличие фильтров из задания 2.
      let filters = "";
      if (Object.keys(args).length > 0) {
        filters = filterResults(args.filter);
      }

      const query = { statement: `SELECT ${reqFields} FROM users ${filters}` };
      const users = await postgres.exec(query);
      return users.rows;
    };
  }

  //дополняем запрос не null фильтрами
  function filterResults(filter) {
    const { manager, blocked, name } = filter;

    let where = "WHERE ";
    if (manager) {
      where = where + "manager=true ";
    }
    if (blocked) {
      //запрос уже больше слова WHERE => дополняем с AND
      if (where.length > 6) {
        where = where + "AND ";
      }
      where = where + "blocked=true ";
    }
    if (name) {
      if (where.length > 6) {
        where = where + "AND ";
      }
      //Искать лучше через регулярные выражения, отрефакторю если будет время
      //https://www.postgresql.org/docs/12/functions-matching.html
      where =
        where +
        `POSITION('${name}' IN name)>0 OR POSITION('${name}' IN login)>0`;
    }
    return where;
  }

  //задание 3. - мутация, сверяем логин:пароль с БД
  function checkCredentials(builderContext) {
    return async function (obj, args, context) {
      //проверяем что аргументы присутствуют
      if (Object.keys(args.auth).length > 0) {
        const { login, pass } = args.auth;
        //проверяем что поля логина и пароля содержат хотя бы по символу
        if (login.length > 0 && pass.length > 0) {
          const queryLogin = {
            statement: `SELECT * FROM users WHERE login='${login}'`,
          };
          const users = await postgres.exec(queryLogin);
          if (users.rows.length > 0) {
            //хэш по паролю
            const hash = crypto.createHash("md5").update(pass).digest("hex");
            const queryPass = {
              statement: `SELECT * FROM users WHERE login='${login}' AND password_hash='${hash}'`,
            };
            const auth = await postgres.exec(queryPass);
            if (auth.rows.length > 0) {
              return [{ result: "Successful Authorization" }];
            } else {
              return [{ result: `Wrong password for user ${login}` }];
            }
          } else {
            return [{ result: `User ${login} does not exist` }];
          }
        } else {
          return [{ result: "Login and pass fields should be non-empty" }];
        }
      } else {
        return [{ result: "No login and pass arguments provided" }];
      }
    };
  }

  return {
    fetchUsers,
    checkCredentials,
  };
});
