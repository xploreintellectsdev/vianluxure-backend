const formatDate = (dateInput) => {
    if (!dateInput) return null;

    const date = new Date(dateInput);
    
    // Strict type check to ensure valid date object
    if (!(date instanceof Date) || isNaN(date.getTime())) {
        return dateInput; 
    }

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    const ampm = hours >= 12 ? 'PM' : 'AM';
    
    hours = hours % 12 || 12; 
    const formattedHours = String(hours).padStart(2, '0');

    // Return format with seconds
    return `${day}-${month}-${year} ${formattedHours}:${minutes}:${seconds} ${ampm}`;
};

const formatDatesInPayload = (data) => {
    if (!data) return data;

    if (Array.isArray(data)) {
        return data.map(item => formatDatesInPayload(item));
    }

    if (typeof data === 'object' && data !== null) {
        if (data instanceof Date) return formatDate(data);

        const formattedData = { ...data };
        
        for (const key in formattedData) {
            const value = formattedData[key];

            if (value instanceof Date) {
                formattedData[key] = formatDate(value);
            } else if (
                typeof value === 'string' && 
                (key.endsWith('_at') || key.endsWith('_date') || key.endsWith('_time'))
            ) {
                const checkDate = new Date(value);
                if (!isNaN(checkDate.getTime())) {
                    formattedData[key] = formatDate(value);
                }
            } else if (typeof value === 'object' && value !== null) {
                formattedData[key] = formatDatesInPayload(value);
            }
        }
        return formattedData;
    }

    return data;
};

module.exports = { formatDate, formatDatesInPayload };