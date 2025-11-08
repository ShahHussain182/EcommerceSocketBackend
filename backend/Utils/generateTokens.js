import jwt from "jsonwebtoken";
export const signAccessToken = (data) => {
return new Promise((resolve,reject) => {
    const payload = {
     ...data
    };
    const secret =  process.env.ACCESS_TOKEN_SECRET;
    const options = {
        expiresIn : '1h',
        issuer : "mupage.com",
        audience : data.userId
    };
    jwt.sign(payload,secret,options,(err , token) => {
        if (err) {
            console.log(err.message);
            reject(err)
        };
        resolve(token);
    })
})
};
export const signRefreshToken = (data) => {
return new Promise((resolve,reject) => {
    const payload = {
     ...data
    };
    const secret =  process.env.REFRESH_TOKEN_SECRET;
    const options = {
        expiresIn : '30d',
        issuer : "mupage.com",
        audience : data.userId
    };
    jwt.sign(payload,secret,options,(err , token) => {
        if (err) {
            console.log(err.message);
            reject(err)
        };
        resolve(token);
    })
})
}
