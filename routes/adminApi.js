const express = require('express');
const admins = require('../models/admins');
const users = require('../models/users');
const main= require('../modules/main');
const adminModule = require('../modules/admin')
const path = require('path')
const routes = express.Router();
const categories = require('../models/categories');
const products = require('../models/products');
const coupons = require('../models/coupons');
const orders = require('../models/orders');
const banners = require('../models/banners');
const fs = require('fs');

const multer = require("multer");
const uploads = multer({
    dest: path.join(__dirname,'../public/uploads/temp/')
    // you might also want to set some limits: https://github.com/expressjs/multer#limits
  })


var apiResponse = {
    status: 404,
    message: "API not found",
    success : false,
    args: {}
}


 /*=======
Admin login validator API
========*/
 routes.post('/loginvalidate', async(req,res)=>{
    let loginuserData={}
    let apiRes = JSON.parse(JSON.stringify(apiResponse));
    apiRes.status=200
    if(req.body.user && req.body.password){
        console.log(req.body.user);
        if(main.validateEmail(req.body.user)){
            loginuserData.email = req.body.user;
        }else{
            loginuserData.username = req.body.user;
        }
        loginuserData['state.deleted']={$ne:true}
        console.log(loginuserData);
        let userData = await admins.findOne(loginuserData)
        console.log(userData);
        if(userData){
            let isLoginValid = await main.hashPasswordvalidate(req.body.password,userData.password)
            if(isLoginValid){
                let userloginUpdate = {};
                userloginUpdate.login_sess = main.randomGen(15);
                userloginUpdate.last_login = Date.now()
                req.session.login_sess_admin = userloginUpdate.login_sess;
                req.session.adminid = userData._id;
                apiRes.message = "Welcome "+userData.name.charAt(0).toUpperCase()+ userData.name.slice(1)+", redirecting you to Dashboard!";
                apiRes.success = true;
                admins.updateOne( loginuserData ,userloginUpdate).then(()=>{
                    console.log('Admin loggedin ('+userData.name+")");
                }).catch((err)=>{
                    console.log(err);
                })
            }else{
                
                apiRes.message = "Ooops! you have entered wrong credentials!";
            }
        }else{
            apiRes.message = "Ooops! you have entered wrong credentials!";
        }
    }else{
        apiRes.message = "Please enter password and username."
    }
    res.status(apiRes.status).json(apiRes)
 })


/*=======
Checking whether loggedin or not
========*/
routes.use(async (req,res,next)=>{
    let isUserLoggedin = await adminModule.authCheck(req);
    if(isUserLoggedin){
        res.locals.userData = await admins.findOne({_id:req.session.adminid})
        if(res.locals.userData.username!='test_user'){
            next();
        }else{
            apiResponse.message = 'You are in test mode of this website, signup to get full access!';
            res.status(200).json(apiResponse);
        }
    }else{
        apiResponse.message = "You have not authorized to access!"
        res.status(200).json(apiResponse)
    }
})



 /*=======
Update user data
========*/
routes.post('/update/:id', async(req,res)=>{
    let apiRes = JSON.parse(JSON.stringify(apiResponse));
    apiRes.status=200
    let toUpdate = {}
    let foundValues = false

    if(req.body.username){
        if(req.body.username.length>=4){
            toUpdate.username = req.body.username.toString().toLowerCase()
            foundValues=true
        }else{
            apiRes.message = 'minimum 4 letters required!'

        }
    }
    if(req.body.name){
        if(req.body.name.length>=4){
            toUpdate.name = req.body.name.toString()
            foundValues=true
        }
    }
    if(req.body.email){
        if(main.validateEmail(req.body.email)){
            toUpdate.email = req.body.email.toString()
            foundValues=true
        }
    }
    if(req.body.phone){
        if(req.body.phone.length>=10){
            toUpdate.phone = req.body.phone
            foundValues=true
        }
    }
    if(req.body.password && req.body.repassword){
        if(req.body.password == req.body.repassword){
            toUpdate.password = await main.hashPassword(req.body.password)
            foundValues=true
        }
    }
    if(foundValues){
        users.updateOne({_id:req.params.id},{$set:toUpdate}).then(()=>{
            apiRes.message = 'Changes are Updated Successfully!'
            apiRes.success = true;
        }).catch((err)=>{
            apiRes.message = 'Something went wrong!!'
            console.log(err);

        }).then(()=>{
            res.status(200).json(apiRes)

        })
    }
     /*=======Deletion and banning=======*/
    if(req.body.action){
        if(req.body.action=='delete'){
            users.deleteOne({_id:req.params.id}).then(()=>{
                apiRes.message = 'Account deleted Successfully!'
                apiRes.success = true;
                 
            }).catch((err)=>{
                apiRes.message = 'Error detucted while updating!'
                console.log(err);

            }).then(()=>{
                res.status(200).json(apiRes)

            })
        }else if(req.body.action=='ban'){
            users.updateOne({_id:req.params.id},{$set:{status:'banned'}}).then(()=>{
                apiRes.message = 'Account banned Successfully!'
                apiRes.success = true;
                 
            }).catch((err)=>{
                apiRes.message = 'Error detucted while updating!'
                console.log(err);

            }).then(()=>{
                res.status(200).json(apiRes)

            })
        }else if(req.body.action=='unban'){
            users.updateOne({_id:req.params.id},{$set:{status:'active'}}).then(()=>{
                apiRes.message = 'Account unbanned Successfully!'
                apiRes.success = true;
                 
            }).catch((err)=>{
                apiRes.message = 'Error detucted while updating!'
                console.log(err);

            }).then(()=>{
                res.status(200).json(apiRes)

            })
        }
    }
})


/*=======
Get user data API
========*/

routes.get('/getuser/:id',async (req,res)=>{
    let apiRes = JSON.parse(JSON.stringify(apiResponse));
    apiRes.status=200
    let userdata = await users.findOne({_id:req.params.id})
    if(userdata){
        apiRes.args.status = userdata.status;
        apiRes.args.name = userdata.name;
        apiRes.success=true
        res.status(200).json(apiRes)
    }else{
        res.status(200).json(apiRes)
    }
})


/*=======
Category data API
========*/

routes.post('/category/create', uploads.single("catImg") ,async (req,res)=>{
    function doCatAction(){
        if(req.body.action=='create'){
            return new categories(dataToUpload).save()
        }else if(req.body.action=='update'){
            if(req.body.id){
                if(req.file){
                    categories.findOne({_id:req.body.id}).then((data)=>{
                        if(data.image){
                            main.deleteFile(path.join(__dirname,'../public/uploads/category/')+data.image)
                        }
                    })
                }
                return categories.updateOne({_id:req.body.id},dataToUpload)
            }else{
                return new Error('required fields are not defined!')
            }
        }else{
            return new Error('required fields are not defined!')
        }
    }
    let apiRes = JSON.parse(JSON.stringify(apiResponse));
    apiRes.status=200
    apiRes.message= 'No data available!'
    apiRes.success = false;
    let dataToUpload ={}
    dataToUpload.last_updated_user = res.locals.userData.username 
    console.log(req.body)
    if(req.body.name && req.body.tags && req.body.action ){ ///&& req.body.action
        dataToUpload.name = req.body.name;
        dataToUpload.tags = req.body.tags.split(',');
        console.log(req.file);
        if(req.file){

            main.uploadimage(req,'category','cat-',true).then((data)=>{ // true = crop
                apiRes.message= data.message;
                apiRes.success = true;
                dataToUpload.image = data.imageName
    
            }).catch((err)=>{
                console.log(err);
                apiRes.message= err.toString()
    
            }).then(()=>{
                if(apiRes.success==true){

                    doCatAction().then(()=>{
                        apiRes.success = true;
                        apiRes.message = 'Successfully updated the category!'

                    }).catch((err)=>{
                        console.log(err);
                        apiRes.success = false;
                        apiRes.message = 'We couldn\'t update your data, try again!'
                    }).then(()=>{
                        res.status(200).json(apiRes)
                    })
                }else{
                    res.status(200).json(apiRes)
                }
            })
        }else{
            doCatAction().then(()=>{
                apiRes.success = true;
                apiRes.message = 'Successfully updated the category!'

            }).catch((err)=>{
                console.log(err);
                apiRes.success = false;
                apiRes.message = 'We couldn\'t update your data, try again! .'
            }).then(()=>{
                res.status(200).json(apiRes)
            })
            
        }
    }else{
        apiRes.message= 'Some required fields are missing!'

        res.status(200).json(apiRes)
    }
})


routes.get('/category/get/:cid', async (req,res)=>{
    let apiRes = JSON.parse(JSON.stringify(apiResponse));
    apiRes.status=200
    apiRes.message= 'No data available!'
    apiRes.success = false;
    let dataToUpload ={}
    categories.findOne({_id:req.params.cid}).then((data)=>{
        if(data){
            apiRes.data = data;
            apiRes.success =true;
            apiRes.message = 'data fetch successfull!'
        }else{
            apiRes.success =false;
            apiRes.message = 'data not found!!'
        }
    })
    .catch((err)=>{
        console.log(err);
        apiRes.message = '400 bad Request!'
    })
    .then(()=>{
        res.status(apiRes.status).json(apiRes)
    })
})

routes.get('/caregory/delete/:cid',async (req,res)=>{
    let apiRes = JSON.parse(JSON.stringify(apiResponse));
    apiRes.success = false;
    apiRes.status=200
    let isProductExistUnderCat = 0;
    try {
         isProductExistUnderCat  = await products.countDocuments({category:req.params.cid})
    } catch (error) {
        console.log(error);
    }
    if(isProductExistUnderCat==0){

        categories.findOne({_id:req.params.cid}).then((data)=>{
            if(data && data.image){
                main.deleteFile(path.join(__dirname,'../public/uploads/category/')+data.image)
            }
        })
        categories.deleteOne({_id:req.params.cid}).then((data)=>{
            console.log(data);
            apiRes.message = 'Your category has been deleted.';
            apiRes.success = true;
            
        }).catch((err)=>{
            console.log(err);
            apiRes.message = 'We couldn\'t complete your proccess, try again later...';
        }).then(()=>{
            res.status(apiRes.status).json(apiRes)
        })
    }else{
        apiRes.message = 'There is one or more product(s) under this category, please update the product(s) first!';
        res.status(apiRes.status).json(apiRes)
    }
})



/*=======
product data API
========*/
/////////CREATE OR EDIT
routes.post('/product/action', uploads.array('product_images', 12) ,async (req,res)=>{
    function doProductAction(){
        if(req.body.action=='create'){
            return new products(dataToUpload).save()
        }else if(req.body.action=='update'){
            if(req.body.id){
                // products.findOne({_id:req.body.id}).then((data)=>{
                //     // if(data.image){
                //     //     main.deleteFile(path.join(__dirname,'../public/uploads/product/')+data.image)
                //     // }
                // })
                if(dataToUpload2.image){   
                    return products.updateOne({_id:req.body.id},{$set:dataToUpload, $push:{image: {$each: dataToUpload2.image}}})
                }else{
                    return products.updateOne({_id:req.body.id},{$set:dataToUpload})

                }
            }else{
                return new Error('required fields are not defined!')
            }
        }else{
            return new Error('required fields are not defined!')
        }
    }
    let apiRes = JSON.parse(JSON.stringify(apiResponse));
    apiRes.status=200
    apiRes.message= 'No data available!'
    apiRes.success = false;
    let dataToUpload ={}
    let dataToUpload2 ={} //for push
    dataToUpload.last_updated_user = res.locals.userData.username
    console.log(req.body)
    if(req.body.name && req.body.tags && req.body.action && req.body.category && req.body.discription && req.body.specification && req.body.unit &&  req.body.sizes){ 
        dataToUpload.name = req.body.name;
        dataToUpload.category = req.body.category;
        dataToUpload.discription = req.body.discription;
        dataToUpload.specification = req.body.specification;
        dataToUpload.unit = req.body.unit;
        dataToUpload.sizes = req.body.sizes;
        dataToUpload.tags = req.body.tags.split(',');
        dataToUpload.sizes = JSON.parse(req.body.sizes);
        if(req.files.length>0){
            main.uploadimages(req,'product','prod-').then((data)=>{
                apiRes.message= data.message;
                apiRes.success = true;
                if(req.body.action=='update'){
                    dataToUpload2.image = data.imageName
                }else{
                    dataToUpload.image = data.imageName
                }
            }).catch((err)=>{
                console.log(err);
                apiRes.message= err.toString()
    
            }).then(()=>{
                if(apiRes.success==true){

                    doProductAction().then(()=>{
                        apiRes.success = true;
                        apiRes.message = 'Successfully updated the product!'

                    }).catch((err)=>{
                        console.log(err);
                        apiRes.success = false;
                        apiRes.message = 'We couldn\'t update your data, try again!'
                    }).then(()=>{
                        res.status(200).json(apiRes)
                    })
                }else{
                    res.status(200).json(apiRes)
                }
            })
        }else{
            doProductAction().then(()=>{
                apiRes.success = true;
                apiRes.message = 'Successfully updated the product!'

            }).catch((err)=>{
                console.log(err);
                apiRes.success = false;
                apiRes.message = 'We couldn\'t update your data, try again! .'
            }).then(()=>{
                res.status(200).json(apiRes)
            })
            
        }
    }else{
        apiRes.message= 'Some required fields are missing!'

        res.status(200).json(apiRes)
    }
})
routes.post('/product/action/deleteImg', (req,res)=>{
    let apiRes = JSON.parse(JSON.stringify(apiResponse));
    apiRes.status=200
    apiRes.message= 'No data available!'
    apiRes.success = false;
    console.log(req.body);
    if(req.body.imgToDlt && req.body.productId){
        products.updateOne({_id:req.body.productId},{$pull:{image:req.body.imgToDlt}})
        .then(()=>{
            apiRes.message= 'Image delete successfully!'
            apiRes.success = true;
            main.deleteFile(path.join(__dirname,'../public/uploads/product/',req.body.imgToDlt))
        }).catch((err)=>{
            console.log(err);
            apiRes.message= 'Something went wrong!'
        }).then(()=>{
            res.status(apiRes.status).json(apiRes)
        })
    }else{
        res.status(apiRes.status).json(apiRes)
    }
})


routes.get('/product/delete/:cid',(req,res)=>{
    let apiRes = JSON.parse(JSON.stringify(apiResponse));
    apiRes.success = false;
    apiRes.status=200
    // products.findOne({_id:req.params.cid}).then((data)=>{ //Disabled for porpose of softDeletion
    //     console.log(data);
    //     if(data && data.image){
    //         console.log('Starting to delete!');
    //         data.image.forEach(val => {
    //             console.log('Deleting '+val);
    //             main.deleteFile(path.join(__dirname,'../public/uploads/product/')+val)
    //         });
    //     }
    // })
    products.updateOne({_id:req.params.cid},{$set:{'state.deleted':true}}).then((data)=>{
        console.log(data);
        apiRes.message = 'Your Product has been deleted.';
        apiRes.success = true;

    }).catch((err)=>{
        console.log(err);
        apiRes.message = 'We couldn\'t complete your proccess, try again later...';
    }).then(()=>{
        res.status(apiRes.status).json(apiRes)
    })
})

/***************
 * UPDATION OR CREATION OF COUPONS
 */
routes.post('/coupon/update',(req,res,next)=>{
    let apiRes = JSON.parse(JSON.stringify(apiResponse));
    apiRes.success = false;
    apiRes.status=200
    apiRes.message='Invalid request!!!'
    if(req.body.action && req.body.id && req.body.name && req.body.code && req.body.discount && req.body.min_order && req.body.expire){
        req.body.expire +=':00.000+00:00'
        if(req.body.pType!='inr' && req.body.pType!='percnt'){
            req.body.pType='inr';
        }
        console.log(req.body);
        if(req.body.action=='create'){
            new coupons({
                name:req.body.name,
                code:req.body.code,
                min_bill:req.body.min_order,
                discount:req.body.discount,
                expire:req.body.expire,
                last_updated_user:res.locals.userData._id,
                pType:req.body.pType
            }).save().then(()=>{
                apiRes.message='Saved successfully!'
                apiRes.success = true;
            }).catch((err)=>{
                apiRes.message='Data already exist or something went wrong!'
                console.log(err);
            }).then(()=>{
                res.status(apiRes.status).json(apiRes)
            })
        }else if(req.body.action == 'update'){
            coupons.updateOne({_id:req.body.id},{$set:{
                name:req.body.name,
                code:req.body.code,
                min_bill:req.body.min_order,
                discount:req.body.discount,
                expire:req.body.expire,
                last_updated_user:res.locals.userData._id,
                pType:req.body.pType
            }}).then(()=>{
                apiRes.message='Saved successfully!'
                apiRes.success = true;
            }).catch((err)=>{
                apiRes.message='Something went wrong!'
                console.log(err);
            }).then(()=>{
                res.status(apiRes.status).json(apiRes)
            })
        }
    }else{
        res.status(apiRes.status).json(apiRes)
    }
})
routes.get('/coupon/get/:id', (req,res,next)=>{
    let apiRes = JSON.parse(JSON.stringify(apiResponse));
    apiRes.success = false;
    apiRes.status=200
    apiRes.message='Invalid request!!!'
    coupons.findOne({_id:req.params.id})
    .then((data)=>{
        if(data){
            apiRes.success = true;
            apiRes.message='Found matching data!'
            apiRes.data=data;
        }else{
            apiRes.message='Invalid code provided!'
        }
    }).catch((err)=>{
        apiRes.message='Data doesn\'t exist or something went wrong!'
        console.log(err);
    }).then(()=>{
        res.status(apiRes.status).json(apiRes)
    })
    
})


routes.get('/coupon/delete/:cid',(req,res)=>{
    let apiRes = JSON.parse(JSON.stringify(apiResponse));
    apiRes.success = false;
    apiRes.status=200
    
    coupons.deleteOne({_id:req.params.cid}).then((data)=>{
        console.log(data);
        apiRes.message = 'Coupon has been deleted.';
        apiRes.success = true;

    }).catch((err)=>{
        console.log(err);
        apiRes.message = 'We couldn\'t complete your proccess, try again later...';
    }).then(()=>{
        res.status(apiRes.status).json(apiRes)
    })
})


routes.post('/order/updateSTS',(req,res)=>{
    let apiRes = JSON.parse(JSON.stringify(apiResponse));
    apiRes.success = false;
    apiRes.status=200
    apiRes.message = 'Something went wrong!';
    let readyToUpdate = false;
    let dataToUpdate = {}
    let dataI = 0;
    async function doAction(i,dataToUpdate){
        switch (i) {
            case 2:
                return await orders.updateOne({_id:req.body.id},{$set:{'delivery_status.shipped':dataToUpdate.shipped}});
                
                break;
            case 3:
                return await orders.updateOne({_id:req.body.id},{$set:{'delivery_status.out_for_delivery':dataToUpdate.out_for_delivery}});
                
                break;
            case 4:
                return await orders.updateOne({_id:req.body.id},{$set:{'delivery_status.delivered':dataToUpdate.delivered}});
                
                break;
        
            default:
                break;
        }
    }
    if(req.body.id && req.body.sts){
        if (req.body.sts >0 && req.body.sts <=4) {
            orders.findOne({_id:req.body.id}).then((data)=>{
                if(data){
                    switch (Number(req.body.sts)) {
                        case 2:
                            if(data.delivery_status.ordered.state){
                                dataI = 2
                                readyToUpdate= true
                                dataToUpdate.shipped = {}
                                dataToUpdate.shipped.state = true
                                dataToUpdate.shipped.date = Date.now()
                            }
                            break;
                        case 3:
                            if(data.delivery_status.shipped.state){
                                dataI = 3
                                readyToUpdate= true
                                dataToUpdate.out_for_delivery = {}
                                dataToUpdate.out_for_delivery.state = true
                                dataToUpdate.out_for_delivery.date = Date.now()
                            }
                            break;
                        case 4:
                            if(data.delivery_status.out_for_delivery.state){
                                dataI = 4
                                readyToUpdate= true
                                dataToUpdate.delivered = {}
                                dataToUpdate.delivered.state = true
                                dataToUpdate.delivered.date = Date.now()
                            }
                            break;
    
                        default:
                            // res.status(apiRes.status).json(apiRes)
                            break;
                    }
                }
                
            }).then(()=>{
                if(readyToUpdate){
                    doAction(dataI,dataToUpdate).then(()=>{
                        apiRes.message = 'Updated status!';
                        apiRes.success = true;
                    }).catch((err)=>{
                        console.log(err);
                    }).then(()=>{
                        res.status(apiRes.status).json(apiRes)
                    })
                }else{
                    res.status(apiRes.status).json(apiRes)
                }
            })
            
        }else{
            res.status(apiRes.status).json(apiRes)
        }
    }else{
        res.status(apiRes.status).json(apiRes)
    }
})

routes.post('/order/codpaid',(req,res)=>{
    let apiRes = JSON.parse(JSON.stringify(apiResponse));
    apiRes.success = false;
    apiRes.status=200
    apiRes.message = 'Something went wrong!';
    if(req.body.id){
        orders.updateOne({_id:req.body.id, 'payment.payment_method':"cash_on_delivery"}, {$set:{'payment.payment_status':'completed'}})
        .then(()=>{
            apiRes.success = true;
            apiRes.message = 'Saved the order as paid!';
        }).catch((err)=>{
            console.log(err);
        }).then(()=>{
            res.status(apiRes.status).json(apiRes)
        })
    }else{
        res.status(apiRes.status).json(apiRes)
    }
})

routes.post('/settings/banner/update',  uploads.single("banrImg") , (req,res,next)=>{


    function doCatAction(){
        if(req.body.action=='create'){
            return new banners(dataToUpload).save()
        }else if(req.body.action=='update'){
            if(req.body.id){
                if(req.file){
                    banners.findOne({_id:req.body.id}).then((data)=>{
                        if(data.image){
                            main.deleteFile(path.join(__dirname,'../public/uploads/banner/')+data.image)
                        }
                    })
                }
                return banners.updateOne({_id:req.body.id},dataToUpload)
            }else{
                return new Error('required fields are not defined!')
            }
        }else{
            return new Error('required fields are not defined!')
        }
    }
    let apiRes = JSON.parse(JSON.stringify(apiResponse));
    apiRes.status=200
    apiRes.message= 'No data available!'
    apiRes.success = false;
    let dataToUpload ={}
    dataToUpload.last_updated_user = res.locals.userData.username 
    console.log(req.body)
    if(req.body.bh1 && req.body.bh2 && req.body.para && req.body.tc && req.body.bc  && req.body.id && req.body.action){ ///&& req.body.action
        dataToUpload.bh1 = req.body.bh1;
        dataToUpload.bh2 = req.body.bh2;
        dataToUpload.para = req.body.para;
        dataToUpload.tc = req.body.tc;
        dataToUpload.bc = req.body.bc;
        console.log(req.file);
        if(req.file){

            main.uploadimage(req,'banner','bnr-',false).then((data)=>{ // false = crop
                apiRes.message= data.message;
                apiRes.success = true;
                dataToUpload.image = data.imageName
    
            }).catch((err)=>{
                console.log(err);
                apiRes.message= err.toString()
    
            }).then(()=>{
                if(apiRes.success==true){

                    doCatAction().then(()=>{
                        apiRes.success = true;
                        apiRes.message = 'Successfully updated the banner!'

                    }).catch((err)=>{
                        console.log(err);
                        apiRes.success = false;
                        apiRes.message = 'We couldn\'t update your data, try again!'
                    }).then(()=>{
                        res.status(200).json(apiRes)
                    })
                }else{
                    res.status(200).json(apiRes)
                }
            })
        }else{
            doCatAction().then(()=>{
                apiRes.success = true;
                apiRes.message = 'Successfully updated the banner!'

            }).catch((err)=>{
                console.log(err);
                apiRes.success = false;
                apiRes.message = 'We couldn\'t update your data, try again! .'
            }).then(()=>{
                res.status(200).json(apiRes)
            })
            
        }
    }else{
        apiRes.message= 'Some required fields are missing!'

        res.status(200).json(apiRes)
    }
    
})



routes.get('/banner/get/:bid', async (req,res)=>{
    let apiRes = JSON.parse(JSON.stringify(apiResponse));
    apiRes.status=200
    apiRes.message= 'No data available!'
    apiRes.success = false;
    banners.findOne({_id:req.params.bid}).then((data)=>{
        if(data){
            apiRes.data = data;
            apiRes.success =true;
            apiRes.message = 'data fetch successfull!'
        }else{
            apiRes.success =false;
            apiRes.message = 'data not found!!'
        }
    })
    .catch((err)=>{
        console.log(err);
        apiRes.message = '400 bad Request!'
    })
    .then(()=>{
        res.status(apiRes.status).json(apiRes)
    })
})

routes.post('/banner/delete',async (req,res)=>{
    let apiRes = JSON.parse(JSON.stringify(apiResponse));
    apiRes.success = false;
    apiRes.status=200
        console.log(req.body);

        banners.findOne({_id:req.body.dltid}).then((data)=>{
            if(data && data.image){
                main.deleteFile(path.join(__dirname,'../public/uploads/banner/')+data.image)
            }
        })
        banners.deleteOne({_id:req.body.dltid}).then((data)=>{
            console.log(data);
            apiRes.message = 'Your banner has been deleted.';
            apiRes.success = true;
            
        }).catch((err)=>{
            console.log(err);
            apiRes.message = 'We couldn\'t complete your proccess, try again later...';
        }).then(()=>{
            res.status(apiRes.status).json(apiRes)
        })
    
})


/*=======
Creat admin account
========*/
routes.post('/admin/create',(req,res)=>{
    let apiRes = JSON.parse(JSON.stringify(apiResponse));
    apiRes.success = false;
    apiRes.status=200
    apiRes.message = 'Missing some fields!'

    if(req.body.name && req.body.email){

        let newAdm = {
            username: "admin_"+main.randomGen(5),
            password: main.randomGen(8),
            name: req.body.name,
            email: req.body.email
        }
        const createAdmin = new admins(
            {   
                username: newAdm.username,
                name: newAdm.name,
                password: main.hashPassword(newAdm.password),
                email: newAdm.email
            }
        )
        createAdmin.save().then(()=>{
            newAdm.email = req.params.email;
            apiRes.message = 'Saved new admin!';
            apiRes.success = true;
            apiRes.data = newAdm;
        }).catch((err)=>{
            console.log(err);
            apiRes.message = 'Something went wrong!'
        }).then(()=>{
            res.status(200).json(apiRes);
            
        })
    }else{
        res.status(200).json(apiRes);

    }
})


 // {"username":"admin_2ld8D","password":"dxpz7QiY","email":"adil.akp1@gmail.com" hash: $2b$10$qx4Oh4fEk5Ep86Z0xag7BeHG7O9HJyTtOgVWIeXNAD2CCNsIUXB.2}


 routes.post('/admin/remove',(req,res)=>{
    let apiRes = JSON.parse(JSON.stringify(apiResponse));
    apiRes.success = false;
    apiRes.status=200
    apiRes.message = 'Missing some fields!'

    if(req.body.id){
        if(req.body.id.toString() !== req.session.adminid.toString()){

            admins.updateOne({_id:req.body.id},{$set:{state:{deleted:true}}})
           .then(()=>{
                apiRes.message = 'Removed the Admin!';
                apiRes.success = true;
            }).catch((err)=>{
                console.log(err);
                apiRes.message = 'Something went wrong!'
            }).then(()=>{
                res.status(200).json(apiRes);
                
            })
        }else{
            apiRes.message = 'You can\'t delete your account!'
            res.status(200).json(apiRes);
        }
    }else{
        res.status(200).json(apiRes);

    }
})
 routes.post('/admin/profile/edit',(req,res)=>{
    let apiRes = JSON.parse(JSON.stringify(apiResponse));
    apiRes.success = false;
    apiRes.status=200
    apiRes.message = 'Missing some fields!'
    let readyToUpdate = false;
    let dataToUpdate = {}
    if(req.body.name){
        dataToUpdate.name =req.body.name 
        readyToUpdate = true;
    }
    
    if(req.body.email){
        dataToUpdate.email =req.body.email 
        readyToUpdate = true;
    }

    if(req.body.password || req.body.repassword){
        if(req.body.password === req.body.repassword){
            
            dataToUpdate.password = main.hashPassword(req.body.password)
            readyToUpdate = true;
        }else{
            readyToUpdate = false;
            apiRes.message = 'Password didn\'t match, try again ';
        }
    }

    if(readyToUpdate){
            admins.updateOne({_id:req.session.adminid},{$set:dataToUpdate})
           .then(()=>{
                apiRes.message = 'Changes are saved!';
                apiRes.success = true;
            }).catch((err)=>{
                console.log(err);
                apiRes.message = 'Something went wrong!'
            }).then(()=>{
                res.status(200).json(apiRes);
                
            })
    }else{
        res.status(200).json(apiRes);

    }
})

 routes.post('/settings',(req,res)=>{
    let apiRes = JSON.parse(JSON.stringify(apiResponse));
    apiRes.success = false;
    apiRes.status=200
    apiRes.message = 'Missing some fields!'
    let readyToUpdate = false;
    let file = path.join(__dirname,'../config/default.json');
    let settings = JSON.parse(fs.readFileSync(file));

    console.log(req.body);
    
    if(req.body.companyname){
        settings.site.name = req.body.companyname;
        readyToUpdate = true
    }
    if(req.body.companyemail){
        settings.site.email = req.body.companyemail;
        readyToUpdate = true
    }
    if(req.body.companyphone){
        settings.site.phone = req.body.companyphone;
        readyToUpdate = true
    }
    if(req.body.companyaddress){
        settings.site.address = req.body.companyaddress;
        readyToUpdate = true
    }   
    if(req.body.instaSwitch){
        settings.site.social.instagram.state = true;
        readyToUpdate = true
    }else{
        readyToUpdate = true
        settings.site.social.instagram.state = false;
    }
    
    if(req.body.fbswitch){
        settings.site.social.facebook.state = true;
        readyToUpdate = true
    }else{
        readyToUpdate = true
        settings.site.social.facebook.state = false;
    }
    if(req.body.twitswitch){
        settings.site.social.twitter.state = true;
        readyToUpdate = true
    }else{
        readyToUpdate = true
        settings.site.social.twitter.state = false;
    }
    if(req.body.lnkdnswitch){
        settings.site.social.linkedin.state = true;
        readyToUpdate = true
    }else{
        readyToUpdate = true
        settings.site.social.linkedin.state = false;
    }
    if(req.body.watpswtich){
        settings.site.social.whatsapp.state = true;
        readyToUpdate = true
    }else{
        readyToUpdate = true
        settings.site.social.whatsapp.state = false;
    }

    if(req.body.instaurl){
        settings.site.social.instagram.url = req.body.instaurl;
        readyToUpdate = true
    }   
    if(req.body.fburl){
        settings.site.social.facebook.url = req.body.fburl;
        readyToUpdate = true
    }   
    if(req.body.twiturl){
        settings.site.social.twitter.url = req.body.twiturl;
        readyToUpdate = true
    }   
    if(req.body.linkedinurl){
        settings.site.social.linkedin.url = req.body.linkedinurl;
        readyToUpdate = true
    }   
    if(req.body.whatsappnum){
        settings.site.social.whatsapp.number = req.body.whatsappnum;
        readyToUpdate = true
    }   

console.log(settings);

    if(readyToUpdate){
        let newjson = JSON.stringify(settings);
        fs.writeFileSync(file, newjson);
        apiRes.message = 'Updated settings!'
        apiRes.success = true

        res.status(apiRes.status).json(apiRes)
    }else{
        res.status(apiRes.status).json(apiRes)
    }
    
})



/*=======
catch 404 and forward to error handler
========*/
routes.use(function(req, res, next) {
    // next(createError(404));
    res.status(apiResponse.status).json(apiResponse)

});

module.exports = routes;
