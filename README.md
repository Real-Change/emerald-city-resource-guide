# [Emerald City Resource Guide](http://www.emeraldcityresourceguide.org/)

The Emerald City Resource Guide (ECRG, [http://www.emeraldcityresourceguide.org/](http://www.emeraldcityresourceguide.org/)) is a directory of social service organizations located in Seattle.  The first hard copy of the guide was published by local non-profit, [Real Change](https://www.realchangenews.org/), in April, 2018, in the hopes of providing an easy reference guide for individuals who may not have access to a computer. v1 of the online version of the guide was released in January, 2019, with the intention of providing the means for updating the guide on a more frequent basis and a creating a dynamic UI for those with access to the internet.

## Getting Started
To run this application on your local machine, you will need to set up a local relational database, install the necessary dependencies, and set up your own environmental variables file.

### Database
**__Local Set Up__**
A static version of the data can be found in the following csv files for local testing:
- [organization table](https://github.com/eckermania/emerald-city-resource-guide/blob/master/organization.csv)
- [category table](https://github.com/eckermania/emerald-city-resource-guide/blob/master/category.csv)
- [organization_x_category table](https://github.com/eckermania/emerald-city-resource-guide/blob/master/organization_x_category.csv)

These csv files can be used to populate your local database:
1. Create your database - within Postgres: 'CREATE <database_name>;'
2. Create schema - load table schema within the root file in the CLI with 'psql -d <database_name> -f guide.sql'
3. Populate tables - load table contents with csv data from within the root file in the CLI using 'psql -d <database_name> -f load.sql'

Depending on how you have set up Postgres on your machine, you may need to manually initialize the connection to Postgres when running your code locally using the following command in CLI: 'pg_ctl -D /usr/local/var/postgres start'.

**__Production__**
To access the production database hosted by Heroku, run 'heroku pg:psql -—app emerald-city-guide' from within CLI and follow login prompts as directed (this is assuming that you have been added as a collaborator to the site on Heroku).

### Dependencies
From within the CLI, install the following npms:

- dotenv
- ejs
- express
- nodemon
- pg

### Environmental Variables
Within your .env file, you must declare the following variables:
- DATABASE_URL - the url for your local database (e.g. postgres://localhost:5432/DATABASE_NAME)
- PORT - the port you'll use to run the app locally (e.g. 8080)

## Testing
Local testing is conducted using mocha and chai.  The test file within this repo is intended to cover the server methods that transform the user inputs in the search form into a SQL query and then retrieves the corresponding records from the database.

## Upcoming Features
- Embedded Google Maps and location filtering

## Built With
- Node.js
- Express web application framework
- Embedded JavaScript Templates (EJS)
- Postgres database

## Author
Erin Eckerman - [https://www.linkedin.com/in/erineckerman/](https://www.linkedin.com/in/erineckerman/)

## License
This project is licensed under the MIT License - see the [LICENSE.md](https://github.com/eckermania/emerald-city-resource-guide/blob/master/LICENSE) for details.

## Acknowledgements

Gratitude to both Katie Comboy and Camilla Walter at Real Change for their partnership throughout the design and testing process.  Thanks to Vinicio Sanchez, Jessica Lovell, and Zahra Mohamed for their input in designing the data model and wireframes.  Extra big thanks to Bogdan Gheorghe for his countless code reviews and assistance in debugging.
