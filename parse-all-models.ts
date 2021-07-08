import AutoRiaPlatformDataFetcher from "./platforms/autoria/AutoRiaPlatformMetaDataFetcher";
import { AutoRiaBrand } from './db'; 
import { ModelsYearsFetcher } from "./ModelsYearsFetcher";
import { CarDataFetcher } from "./parser/types";

var fs = require('fs');
var util = require('util');
var log_file = fs.createWriteStream(__dirname + '/debug.log', {flags : 'w'});
var log_stdout = process.stdout;

console.error = function(d) { //
  log_file.write(util.format(d) + '\n');
  log_stdout.write(util.format(d) + '\n');
};

const autoRiaPlatformDataFetcher = new AutoRiaPlatformDataFetcher();
const modelsYearsFetcher = new ModelsYearsFetcher();

(async() => {
    const brands = await autoRiaPlatformDataFetcher.getAllBrands();
    console.log(1)
    for (let i = 0; i < brands.length; i++) {
        const exisedBrand = await AutoRiaBrand.findOne({ name: brands[i] });
        if (exisedBrand && exisedBrand.models.length) continue;
        const brandName = brands[i].split('_')[0].trim();
        
        let allModels = [];
        try {
            allModels = await autoRiaPlatformDataFetcher.getAllModels(brandName);
        } catch (e) {
            console.log(e);
        }

        const models = [];

        for (let i = 0; i < allModels.length; i++) {
            const existedModel = exisedBrand?.models.find(o => o.name === allModels[i]);
            
            if (exisedBrand && existedModel && existedModel.years.length) continue;
            
            const modelName = allModels[i].split('_')[0].trim();

            let years = [];

            const exceptionModel = CarDataFetcher.getNameOfExceptionModel(brandName, modelName);

            try {
                years = await modelsYearsFetcher.getYearsOfModel(brandName, modelName)
            } catch (e) {
                console.log(e);
            }

            if (!years.length && exceptionModel) {
                try {
                    years = await modelsYearsFetcher.getYearsOfModel(brandName, exceptionModel)
                } catch (e) {
                    console.log(e);
                }
            }

            const updatedYears = years.map(range => range.map((item,) => {
                if (item === "NaN" || isNaN(parseInt(item)) || item === 0) return null;
                else return parseInt(item);
            }))

            const newModel = { name: allModels[i], years: updatedYears };

            if (exisedBrand) {
                if (existedModel) {
                    existedModel.years = newModel.years;
                }
                else exisedBrand.models.push(newModel)
            }
            else models.push(newModel)
        }

        const targetBrand = exisedBrand || new AutoRiaBrand({ name: brands[i], models: models });

        targetBrand.save()
    }

    // const brands = await AutoRiaBrand.find();


    // for (let i = 0; i < brands.length; i++) {
    //     const brand = brands[i];
    //     brand.models = brand.models.map(model => ({
    //         name: model.name,
    //         years: model.years.reduce((prev, range, i) => {
    //             if (!range[0]) return prev;
    //             const to = model.years[i + 1] ? model.years[i + 1][0] : range[1];

    //             return [
    //                 ...prev,
    //                 [range[0], to || new Date().getFullYear()],
    //             ];
    //         }, []),
    //     }))
    //     console.log('save')
    //     await brand.save();
    // }
})()    