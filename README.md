# [Emerald City Resource Guide](http://www.emeraldcityresourceguide.org/)

The Emerald City Resource Guide (ECRG, [http://www.emeraldcityresourceguide.org/](http://www.emeraldcityresourceguide.org/)) is a directory of social service organizations located in Seattle.  The first hard copy of the guide was published by local non-profit, [Real Change](https://www.realchangenews.org/), in April, 2018, in the hopes of providing an easy reference guide for individuals who may not have access to a computer. v1 of the online version of the guide was released in January, 2019, with the intention of providing the means for updating the guide on a more frequent basis and a creating a dynamic UI for those with access to the internet.

## Getting Started

Follow these steps to set up a local development environment:
1. Install [docker and docker-compose](https://docs.docker.com/get-docker/)
2. Create a file named `.env` in your clone of this repository with two lines, one setting `FIREBASE_CONFIG` and one setting `GOOGLE_CONFIG`. Copy-and-paste the values from https://dashboard.heroku.com/apps/emerald-city-guide/settings, but make sure to remove newlines.

    ```
    FIREBASE_CONFIG={ apiKey...
    GOOGLE_CONFIG={ "type":...
    ```

3. Install dependencies and set up the DB with `make setup`
4. Launch the server with `make start` and visit http://localhost:8080/

Use `make db-connect` to open a `psql shell inside the Docker DB container and `make db-restore` to restore from a backup.

## Testing
Local testing is conducted using mocha and chai. Run the tests using `make test`

The test file within this repo is intended to cover the server methods that transform the user inputs in the search form into a SQL query and then retrieves the corresponding records from the database.

## Production
ECRG is hosted on Fly.io ([dashboard link](https://fly.io/dashboard/emerald-city-resource-guide/)). Steps to to access the production database:
1. [Install flyctl](https://fly.io/docs/hands-on/install-flyctl/)
2. Run `flyctl auth login`
3. Run `fly postgres connect -a emerald-city-resource-guide-db` 

To get a dump of the DB, run `./db/fly_db_dump.sh`.

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
