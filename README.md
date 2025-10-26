
# install steps

* install nodejs (v6)

* install webpack

npm install -g webpack

* install packages

npm install

* pack and compile js files 

webpack 

* run server

node bin/www

## build static site for GitHub Pages

```
npm run build:static
```

The generated static site will be available in the `docs/` directory and can be published directly with GitHub Pages.
Adjust the `base_path` value in `config.js` (or set the `BASE_PATH` environment variable when running the build command) if your repository is served from a different sub-path.
