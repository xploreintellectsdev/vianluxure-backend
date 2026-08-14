const { formatDatesInPayload } = require('./formatDate'); 

const successRes = (res, message, data = null, meta = null, statusCode = 200) => {
    const response = { success: true, message };

    if (data) response.data = formatDatesInPayload(data); 
    
    if (meta) response.meta = meta;
    
    return res.status(statusCode).json(response);
};

const errorRes = (res, message, statusCode = 500, error = null) => {
    const response = { success: false, message };
    if (process.env.NODE_ENV === 'development' && error) {
        response.error = error.message || error; 
    }
    return res.status(statusCode).json(response);
};

module.exports = { successRes, errorRes };