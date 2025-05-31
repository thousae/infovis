const margin = { top: 50, right: 30, bottom: 100, left: 60 };
const width = 1000 - margin.left - margin.right;
const height = 600 - margin.top - margin.bottom;

const svg = d3.select("#visualization")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

const tooltip = d3.select("body")
    .append("div")
    .attr("class", "tooltip")
    .style("opacity", 0);

const monthNameToNumber = {
    "January": 1, "February": 2, "March": 3, "April": 4,
    "May": 5, "June": 6, "July": 7, "August": 8,
    "September": 9, "October": 10, "November": 11, "December": 12
};
const monthNumberToShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

d3.csv("library_data.csv").then(data => {
    data.forEach(d => {
        d.TotalCheckouts = +d["Total Checkouts"];
        d.Month = monthNameToNumber[d["Circulation Active Month"]];
        d.Year = +d["Circulation Active Year"];
        d.Branch = d["Home Library Definition"];
    });

    const branches = Array.from(new Set(data.map(d => d.Branch))).sort();
    const branchFilter = d3.select("#branchFilter");
    branchFilter.append("option").text("Total").attr("value", "");
    branches.forEach(branch => {
        branchFilter.append("option").text(branch).attr("value", branch);
    });

    const years = Array.from(new Set(data.map(d => d.Year))).sort((a, b) => a - b);
    const yearFilter = d3.select("#yearFilter");
    yearFilter.append("option").text("Total").attr("value", "");
    years.forEach(year => {
        yearFilter.append("option").text(year).attr("value", year);
    });

    const yearLabel = d3.select("#yearLabel");

    const monthLabel = d3.select("#monthLabel");
    const monthFilter = d3.select("#monthFilter");
    
    monthFilter.selectAll("option").remove();
    monthFilter.append("option").text("All").attr("value", "");
    monthNumberToShort.forEach((m, i) => {
        monthFilter.append("option").text(m).attr("value", i + 1);
    });

    let trendMode = "yearly";
    const trendModeDiv = d3.select("#trend-mode");
    const trendBtns = d3.selectAll(".trend-btn");
    trendBtns.on("click", function() {
        trendBtns.classed("active", false);
        d3.select(this).classed("active", true);
        trendMode = d3.select(this).attr("data-mode");
        updateVisualization();
    });

    const metricLabel = d3.select("#metricLabel");
    const metricFilter = d3.select("#metricFilter");
    const groupbyLabel = d3.select("#groupbyLabel");
    const groupbyFilter = d3.select("#groupbyFilter");
    const numericCols = ["Total Checkouts", "Total Renewals"];
    const categoricalCols = ["Patron Type Definition", "Age Range", "Circulation Active Year", "Home Library Definition"];
    function populateCustomDropdowns() {
        metricFilter.selectAll("option").remove();
        metricFilter.append("option").text("All").attr("value", "all");
        let firstMetric = "all";
        numericCols.forEach(col => {
            if (data[0] && data[0][col] !== undefined) {
                metricFilter.append("option").text(col).attr("value", col);
            }
        });
        groupbyFilter.selectAll("option").remove();
        let firstGroup = null;
        categoricalCols.forEach(col => {
            if (data[0] && data[0][col] !== undefined) {
                groupbyFilter.append("option").text(col).attr("value", col);
                if (!firstGroup) firstGroup = col;
            }
        });
        metricFilter.property("value", firstMetric);
        if (firstGroup) groupbyFilter.property("value", firstGroup);
    }

    function drawCustomBarChart() {
        d3.select("#visualization").selectAll("*").remove();
        const metric = metricFilter.property("value");
        const groupby = groupbyFilter.property("value");
        const selectedBranch = branchFilter.property("value");
        
        let filtered = data;
        if (selectedBranch) {
            filtered = filtered.filter(d => d.Branch === selectedBranch);
        }
        if (!metric || !groupby) return;
        if (metric === "all") {
            
            const grouped = d3.rollups(
                filtered,
                v => ({
                    checkouts: d3.sum(v, d => +d["Total Checkouts"]),
                    renewals: d3.sum(v, d => +d["Total Renewals"])
                }),
                d => d[groupby]
            );
            let chartData = grouped.map(([key, vals]) => ({
                key,
                checkouts: vals.checkouts,
                renewals: vals.renewals
            })).filter(d => d.key !== undefined && d.key !== null && d.key !== "" && (!isNaN(d.checkouts) || !isNaN(d.renewals)));
            if (chartData.length === 0) return;
            chartData.sort((a, b) => (b.checkouts + b.renewals) - (a.checkouts + a.renewals));
            const margin = { top: 40, right: 30, bottom: 100, left: 80 };
            const width = 900 - margin.left - margin.right;
            const height = 500 - margin.top - margin.bottom;
            const svg = d3.select("#visualization")
                .append("svg")
                .attr("width", width + margin.left + margin.right)
                .attr("height", height + margin.top + margin.bottom)
                .append("g")
                .attr("transform", `translate(${margin.left},${margin.top})`);
            const x0 = d3.scaleBand()
                .domain(chartData.map(d => d.key))
                .range([0, width])
                .padding(0.2);
            const subgroups = ["checkouts", "renewals"];
            const x1 = d3.scaleBand()
                .domain(subgroups)
                .range([0, x0.bandwidth()])
                .padding(0.1);
            const maxVal = d3.max(chartData, d => Math.max(d.checkouts, d.renewals));
            const minVal = d3.min(chartData, d => Math.min(d.checkouts, d.renewals));
            const colorScales = {
                checkouts: d3.scaleSequential().domain([minVal, maxVal]).interpolator(t => d3.interpolateGreens(0.4 + 0.6 * t)),
                renewals: d3.scaleSequential().domain([minVal, maxVal]).interpolator(t => d3.interpolateBlues(0.4 + 0.6 * t))
            };
            const y = d3.scaleLinear()
                .domain([0, d3.max(chartData, d => Math.max(d.checkouts, d.renewals))]).nice()
                .range([height, 0]);
            svg.append("g")
                .attr("transform", `translate(0,${height})`)
                .call(d3.axisBottom(x0))
                .selectAll("text")
                .attr("transform", "rotate(-30)")
                .style("text-anchor", "end");
            svg.append("g")
                .call(d3.axisLeft(y));
            svg.selectAll("g.bar-group")
                .data(chartData)
                .enter()
                .append("g")
                .attr("class", "bar-group")
                .attr("transform", d => `translate(${x0(d.key)},0)`)
                .selectAll("rect")
                .data(d => subgroups.map(key => ({ key, value: d[key], group: d.key })))
                .enter()
                .append("rect")
                .attr("x", d => x1(d.key))
                .attr("y", d => y(d.value))
                .attr("width", x1.bandwidth())
                .attr("height", d => height - y(d.value))
                .attr("fill", d => colorScales[d.key](d.value))
                .on("mouseover", function(event, d) {
                    tooltip.transition().duration(200).style("opacity", .9);
                    tooltip.html(`<b>${d.group}</b><br>${d.key === 'checkouts' ? 'Checkouts' : 'Renewals'}: ${d.value}`)
                        .style("left", (event.pageX + 10) + "px")
                        .style("top", (event.pageY - 28) + "px");
                })
                .on("mouseout", function() {
                    tooltip.transition().duration(500).style("opacity", 0);
                });
            
            const legend = svg.append("g")
                .attr("transform", `translate(0, -30)`);
            subgroups.forEach((key, i) => {
                legend.append("rect")
                    .attr("x", i * 120)
                    .attr("width", 18)
                    .attr("height", 18)
                    .attr("fill", colorScales[key]((maxVal+minVal)/2));
                legend.append("text")
                    .attr("x", i * 120 + 24)
                    .attr("y", 14)
                    .text(key === 'checkouts' ? 'Checkouts' : 'Renewals')
                    .style("font-size", "13px");
            });
            svg.append("text")
                .attr("class", "axis-label")
                .attr("text-anchor", "middle")
                .attr("transform", "rotate(-90)")
                .attr("x", -height / 2)
                .attr("y", -margin.left + 15)
                .text("Count");
            svg.append("text")
                .attr("class", "axis-label")
                .attr("text-anchor", "middle")
                .attr("x", width / 2)
                .attr("y", height + margin.bottom - 10)
                .text(groupby);
        } else {
            
            const grouped = d3.rollup(
                filtered,
                v => d3.sum(v, d => +d[metric]),
                d => d[groupby]
            );
            let chartData = Array.from(grouped, ([key, value]) => ({ key, value }))
                .filter(d => d.key !== undefined && d.key !== null && d.key !== "" && !isNaN(d.value));
            if (chartData.length === 0) return;
            chartData.sort((a, b) => b.value - a.value);
            const margin = { top: 40, right: 30, bottom: 100, left: 80 };
            const width = 900 - margin.left - margin.right;
            const height = 500 - margin.top - margin.bottom;
            const svg = d3.select("#visualization")
                .append("svg")
                .attr("width", width + margin.left + margin.right)
                .attr("height", height + margin.top + margin.bottom)
                .append("g")
                .attr("transform", `translate(${margin.left},${margin.top})`);
            const x = d3.scaleBand()
                .domain(chartData.map(d => d.key))
                .range([0, width])
                .padding(0.2);
            svg.append("g")
                .attr("transform", `translate(0,${height})`)
                .call(d3.axisBottom(x))
                .selectAll("text")
                .attr("transform", "rotate(-30)")
                .style("text-anchor", "end");
            const y = d3.scaleLinear()
                .domain([0, d3.max(chartData, d => d.value)]).nice()
                .range([height, 0]);
            svg.append("g")
                .call(d3.axisLeft(y));
            
            const minVal = d3.min(chartData, d => d.value);
            const maxVal = d3.max(chartData, d => d.value);
            const colorScale = d3.scaleSequential()
                .domain([minVal, maxVal])
                .interpolator(d3.interpolateGreens);
            svg.selectAll("rect")
                .data(chartData)
                .enter()
                .append("rect")
                .attr("x", d => x(d.key))
                .attr("y", d => y(d.value))
                .attr("width", x.bandwidth())
                .attr("height", d => height - y(d.value))
                .attr("fill", d => colorScale(d.value))
                .on("mouseover", function(event, d) {
                    tooltip.transition().duration(200).style("opacity", .9);
                    tooltip.html(`<b>${d.key}</b><br>${metric}: ${d.value}`)
                        .style("left", (event.pageX + 10) + "px")
                        .style("top", (event.pageY - 28) + "px");
                })
                .on("mouseout", function() {
                    tooltip.transition().duration(500).style("opacity", 0);
                });
            svg.append("text")
                .attr("class", "axis-label")
                .attr("text-anchor", "middle")
                .attr("transform", "rotate(-90)")
                .attr("x", -height / 2)
                .attr("y", -margin.left + 15)
                .text(metric);
            svg.append("text")
                .attr("class", "axis-label")
                .attr("text-anchor", "middle")
                .attr("x", width / 2)
                .attr("y", height + margin.bottom - 10)
                .text(groupby);
        }
    }

    
    function filterData() {
        const selectedBranch = branchFilter.property("value");
        const selectedYear = yearFilter.property("value");
        const selectedMonth = monthFilter.property("value");
        let filtered = data;
        if (selectedBranch) {
            filtered = filtered.filter(d => d.Branch === selectedBranch);
        }
        if (currentViz === "line") {
            if (trendMode === "yearly" && selectedMonth) {
                filtered = filtered.filter(d => d.Month == selectedMonth);
            }
            if (trendMode === "monthly" && selectedYear) {
                filtered = filtered.filter(d => d.Year == selectedYear);
            }
        }
        return filtered;
    }

    
    function drawLineChart(filtered) {
        let chartData;
        let xDomain, xLabel, xTickFormat;
        if (trendMode === "yearly") {
            
            const yearly = d3.rollup(
                filtered,
                v => d3.sum(v, d => d.TotalCheckouts),
                d => d.Year
            );
            chartData = Array.from(yearly, ([year, count]) => ({ year: +year, count }))
                .sort((a, b) => a.year - b.year);
            xDomain = chartData.map(d => d.year);
            xLabel = "Year";
            xTickFormat = d => d;
        } else {
            
            const monthly = d3.rollup(
                filtered,
                v => d3.sum(v, d => d.TotalCheckouts),
                d => d.Month
            );
            chartData = Array.from(monthly, ([month, count]) => ({ month: +month, count }))
                .sort((a, b) => a.month - b.month);
            xDomain = chartData.map(d => d.month);
            xLabel = "Month";
            xTickFormat = d => monthNumberToShort[d - 1];
        }
        
        chartData = chartData.filter(d => !isNaN(d.count) && (trendMode === "yearly" ? !isNaN(d.year) : !isNaN(d.month)));
        
        if (trendMode === "yearly") {
            xDomain = chartData.map(d => d.year);
        } else {
            xDomain = chartData.map(d => d.month);
        }
        d3.select("#visualization").selectAll("*").remove();
        const margin = { top: 40, right: 30, bottom: 60, left: 80 };
        const width = 900 - margin.left - margin.right;
        const height = 500 - margin.top - margin.bottom;
        const svg = d3.select("#visualization")
            .append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);
        
        const x = d3.scaleBand()
            .domain(xDomain)
            .range([0, width])
            .padding(0.1);
        
        const y = d3.scaleLinear()
            .domain([0, d3.max(chartData, d => d.count)]).nice()
            .range([height, 0]);
        svg.append("g")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(x).tickFormat(xTickFormat));
        svg.append("g")
            .call(d3.axisLeft(y));
        
        const line = d3.line()
            .x(d => x(trendMode === "yearly" ? d.year : d.month) + x.bandwidth() / 2)
            .y(d => y(d.count));
        svg.append("path")
            .datum(chartData)
            .attr("fill", "none")
            .attr("stroke", "#4CAF50")
            .attr("stroke-width", 2)
            .attr("d", line);
        
        svg.selectAll("circle")
            .data(chartData)
            .enter()
            .append("circle")
            .attr("cx", d => x(trendMode === "yearly" ? d.year : d.month) + x.bandwidth() / 2)
            .attr("cy", d => y(d.count))
            .attr("r", 4)
            .attr("fill", "#4CAF50")
            .on("mouseover", function(event, d) {
                let label = trendMode === "yearly" ? `Year: ${d.year}` : `Month: ${d.month}`;
                tooltip.transition().duration(200).style("opacity", .9);
                tooltip.html(`${label}<br>Checkouts: ${d.count.toLocaleString()}`)
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 28) + "px");
            })
            .on("mouseout", function() {
                tooltip.transition().duration(500).style("opacity", 0);
            });
        
        svg.append("text")
            .attr("class", "axis-label")
            .attr("text-anchor", "middle")
            .attr("transform", "rotate(-90)")
            .attr("x", -height / 2)
            .attr("y", -margin.left + 10)
            .text("Checkouts");
        
        svg.append("text")
            .attr("class", "axis-label")
            .attr("text-anchor", "middle")
            .attr("x", width / 2)
            .attr("y", height + margin.bottom - 10)
            .text(xLabel);
    }

    
    const heatmapValueLabel = d3.select("#heatmapValueLabel");
    const heatmapValueFilter = d3.select("#heatmapValueFilter");
    const heatmapRowLabel = d3.select("#heatmapRowLabel");
    const heatmapRowFilter = d3.select("#heatmapRowFilter");
    const heatmapColLabel = d3.select("#heatmapColLabel");
    const heatmapColFilter = d3.select("#heatmapColFilter");
    
    const numericColsHeatmap = ["Total","Total Checkouts", "Total Renewals"];
    const rowColsHeatmap = ["Patron Type Definition", "Home Library Definition", "Age Range"];
    const colColsHeatmap = [ "Supervisor District", "Patron Type Definition"];
    
    function populateHeatmapDropdowns() {
        heatmapValueFilter.selectAll("option").remove();
        heatmapValueFilter.append("option").text("Total").attr("value", "total");
        numericColsHeatmap.forEach(col => {
            if (data[0] && data[0][col] !== undefined) {
                heatmapValueFilter.append("option").text(col).attr("value", col);
            }
        });
        heatmapRowFilter.selectAll("option").remove();
        rowColsHeatmap.forEach(col => {
            if (data[0] && data[0][col] !== undefined) {
                heatmapRowFilter.append("option").text(col).attr("value", col);
            }
        });
        heatmapColFilter.selectAll("option").remove();
        colColsHeatmap.forEach(col => {
            if (data[0] && data[0][col] !== undefined) {
                heatmapColFilter.append("option").text(col).attr("value", col);
            }
        });
        
        heatmapValueFilter.property("value", "total");
        if (heatmapRowFilter.selectAll("option").size() > 0) heatmapRowFilter.property("value", rowColsHeatmap[0]);
        if (heatmapColFilter.selectAll("option").size() > 0) heatmapColFilter.property("value", colColsHeatmap[0]);
    }

    
    function drawHeatmap() {
        d3.select("#visualization").selectAll("*").remove();
        const valueCol = heatmapValueFilter.property("value");
        const rowCol = heatmapRowFilter.property("value");
        const colCol = heatmapColFilter.property("value");
        if (!valueCol || !rowCol || !colCol) return;
        if (rowCol === colCol) {
            d3.select("#visualization").append("div").style("color","#b00").style("font-size","18px").text("Row and Column must be different.");
            return;
        }
        
        let pivot;
        if (valueCol === "total") {
            pivot = d3.rollups(
                data,
                v => d3.mean(v, d => +d["Total Checkouts"] + +d["Total Renewals"]),
                d => d[rowCol],
                d => d[colCol]
            );
        } else {
            pivot = d3.rollups(
                data,
                v => d3.mean(v, d => +d[valueCol]),
                d => d[rowCol],
                d => d[colCol]
            );
        }
        const rowKeys = Array.from(new Set(data.map(d => d[rowCol]))).filter(d => d !== undefined && d !== null && d !== "");
        let colKeys = Array.from(new Set(data.map(d => d[colCol]))).filter(d => d !== undefined && d !== null && d !== "");
        
        if (colCol === "Circulation Active Month") {
            colKeys = monthNumberToShort;
        }
        
        let heatmapData = [];
        pivot.forEach(([row, arr]) => {
            const colMap = new Map(arr);
            colKeys.forEach(col => {
                heatmapData.push({
                    row,
                    col,
                    value: colMap.get(col)
                });
            });
        });
        
        const values = heatmapData.map(d => d.value).filter(v => v !== undefined && !isNaN(v));
        if (values.length === 0) {
            d3.select("#visualization").append("div").style("color","#b00").style("font-size","18px").text("No data for selected combination.");
            return;
        }
        const minVal = d3.min(values);
        const maxVal = d3.max(values);
        const colorScale = d3.scaleSequential().domain([minVal, maxVal]).interpolator(d3.interpolateViridis);
        
        const margin = { top: 80, right: 30, bottom: 100, left: 140 };
        const cellSize = 40;
        const width = colKeys.length * cellSize;
        const height = rowKeys.length * cellSize;
        const svg = d3.select("#visualization")
            .append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);
        
        svg.selectAll()
            .data(heatmapData)
            .enter()
            .append("rect")
            .attr("x", d => colKeys.indexOf(d.col) * cellSize)
            .attr("y", d => rowKeys.indexOf(d.row) * cellSize)
            .attr("width", cellSize)
            .attr("height", cellSize)
            .attr("fill", d => d.value === undefined || isNaN(d.value) ? "#eee" : colorScale(d.value))
            .attr("stroke", "#fff")
            .on("mouseover", function(event, d) {
                if (d.value !== undefined && !isNaN(d.value)) {
                    tooltip.transition().duration(200).style("opacity", .9);
                    tooltip.html(`<b>${rowCol}: ${d.row}<br>${colCol}: ${d.col}<br>${valueCol}: ${d.value.toFixed(1)}`)
                        .style("left", (event.pageX + 10) + "px")
                        .style("top", (event.pageY - 28) + "px");
                }
            })
            .on("mouseout", function() {
                tooltip.transition().duration(500).style("opacity", 0);
            });
        
        svg.append("g")
            .selectAll("text")
            .data(colKeys)
            .enter()
            .append("text")
            .attr("x", (d, i) => i * cellSize + cellSize / 2)
            .attr("y", height + 18)
            .attr("text-anchor", "end")
            .attr("font-size", "13px")
            .attr("transform", (d, i) => `rotate(-45,${i * cellSize + cellSize / 2},${height + 18})`)
            .text(d => d);
        
        svg.append("g")
            .selectAll("text")
            .data(rowKeys)
            .enter()
            .append("text")
            .attr("x", -10)
            .attr("y", (d, i) => i * cellSize + cellSize / 2 + 5)
            .attr("text-anchor", "end")
            .attr("font-size", "13px")
            .text(d => d);
        
        svg.append("text")
            .attr("x", width / 2)
            .attr("y", -60)
            .attr("text-anchor", "middle")
            .attr("font-size", "18px")
            .attr("font-weight", "bold")
            .text(`${rowCol} vs ${colCol} (mean ${valueCol})`);
    }

    
    function drawNoticeBarChart(filtered) {
        d3.select("#visualization").selectAll("*").remove();
        
        const groupData = d3.rollups(
            filtered,
            v => v.length,
            d => d["Patron Type Definition"],
            d => d["Notice Preference Definition"]
        );
        
        const noticeTypes = Array.from(new Set(filtered.map(d => d["Notice Preference Definition"])));
        
        let chartData = [];
        groupData.forEach(([patronType, arr]) => {
            const noticeMap = new Map(arr);
            noticeTypes.forEach(noticeType => {
                chartData.push({
                    patronType,
                    noticeType,
                    count: noticeMap.get(noticeType) || 0
                });
            });
        });
        
        const validPatronTypes = Array.from(new Set(chartData
            .filter(d => d.count > 0)
            .map(d => d.patronType)));
        chartData = chartData.filter(d => validPatronTypes.includes(d.patronType));
        
        const margin = { top: 40, right: 30, bottom: 100, left: 70 };
        const width = 900 - margin.left - margin.right;
        const height = 500 - margin.top - margin.bottom;
        
        const svg = d3.select("#visualization")
            .append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);
        
        const x0 = d3.scaleBand()
            .domain(validPatronTypes)
            .range([0, width])
            .paddingInner(0.2);
        
        const x1 = d3.scaleBand()
            .domain(noticeTypes)
            .range([0, x0.bandwidth()])
            .padding(0.05);
        
        const y = d3.scaleLinear()
            .domain([0, d3.max(chartData, d => d.count)]).nice()
            .range([height, 0]);
        
        const color = d3.scaleOrdinal()
            .domain(noticeTypes)
            .range(d3.schemeSet2);
        
        svg.append("g")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(x0))
            .selectAll("text")
            .attr("transform", "rotate(-30)")
            .style("text-anchor", "end");
        
        svg.append("g")
            .call(d3.axisLeft(y));
        
        svg.selectAll("g.bar-group")
            .data(validPatronTypes)
            .enter()
            .append("g")
            .attr("class", "bar-group")
            .attr("transform", d => `translate(${x0(d)},0)`)
            .selectAll("rect")
            .data(pt => chartData.filter(d => d.patronType === pt))
            .enter()
            .append("rect")
            .attr("x", d => x1(d.noticeType))
            .attr("y", d => y(d.count))
            .attr("width", x1.bandwidth())
            .attr("height", d => height - y(d.count))
            .attr("fill", d => color(d.noticeType))
            .on("mouseover", function(event, d) {
                tooltip.transition().duration(200).style("opacity", .9);
                tooltip.html(`<b>${d.patronType}</b><br>${d.noticeType}: ${d.count}`)
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 28) + "px");
            })
            .on("mouseout", function() {
                tooltip.transition().duration(500).style("opacity", 0);
            });
        
        const legend = svg.append("g")
            .attr("transform", `translate(0, -30)`);
        noticeTypes.forEach((nt, i) => {
            legend.append("rect")
                .attr("x", i * 120)
                .attr("width", 18)
                .attr("height", 18)
                .attr("fill", color(nt));
            legend.append("text")
                .attr("x", i * 120 + 24)
                .attr("y", 14)
                .text(nt)
                .style("font-size", "13px");
        });
        
        svg.append("text")
            .attr("class", "axis-label")
            .attr("text-anchor", "middle")
            .attr("transform", "rotate(-90)")
            .attr("x", -height / 2)
            .attr("y", -margin.left + 15)
            .text("Count");
    }

    
    function drawPatronBarChart(filtered) {
        d3.select("#visualization").selectAll("*").remove();
        
        const groupData = d3.rollups(
            filtered,
            v => ({
                checkouts: d3.sum(v, d => d.TotalCheckouts),
                renewals: d3.sum(v, d => +d["Total Renewals"])
            }),
            d => d["Patron Type Definition"]
        );
        const patronTypes = groupData.map(([pt]) => pt);
        const chartData = groupData.map(([pt, vals]) => ({
            patronType: pt,
            checkouts: vals.checkouts,
            renewals: vals.renewals
        }));
        
        const margin = { top: 40, right: 30, bottom: 60, left: 80 };
        const width = 900 - margin.left - margin.right;
        const height = 500 - margin.top - margin.bottom;
        const svg = d3.select("#visualization")
            .append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);
        
        const x0 = d3.scaleBand()
            .domain(patronTypes)
            .range([0, width])
            .padding(0.2);
        
        const subgroups = ["checkouts", "renewals"];
        const x1 = d3.scaleBand()
            .domain(subgroups)
            .range([0, x0.bandwidth()])
            .padding(0.1);
        
        const y = d3.scaleLinear()
            .domain([0, d3.max(chartData, d => Math.max(d.checkouts, d.renewals))]).nice()
            .range([height, 0]);
        
        const color = d3.scaleOrdinal()
            .domain(subgroups)
            .range(["#4CAF50", "#2196F3"]);
        
        svg.append("g")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(x0))
            .selectAll("text")
            .attr("transform", "rotate(-30)")
            .style("text-anchor", "end");
        
        svg.append("g")
            .call(d3.axisLeft(y));
        
        svg.selectAll("g.bar-group")
            .data(chartData)
            .enter()
            .append("g")
            .attr("class", "bar-group")
            .attr("transform", d => `translate(${x0(d.patronType)},0)`)
            .selectAll("rect")
            .data(d => subgroups.map(key => ({ key, value: d[key], patronType: d.patronType })))
            .enter()
            .append("rect")
            .attr("x", d => x1(d.key))
            .attr("y", d => y(d.value))
            .attr("width", x1.bandwidth())
            .attr("height", d => height - y(d.value))
            .attr("fill", d => color(d.key))
            .on("mouseover", function(event, d) {
                tooltip.transition().duration(200).style("opacity", .9);
                tooltip.html(`<b>${d.patronType}</b><br>${d.key === 'checkouts' ? 'Checkouts' : 'Renewals'}: ${d.value}`)
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 28) + "px");
            })
            .on("mouseout", function() {
                tooltip.transition().duration(500).style("opacity", 0);
            });
        
        const legend = svg.append("g")
            .attr("transform", `translate(0, -30)`);
        subgroups.forEach((key, i) => {
            legend.append("rect")
                .attr("x", i * 120)
                .attr("width", 18)
                .attr("height", 18)
                .attr("fill", color(key));
            legend.append("text")
                .attr("x", i * 120 + 24)
                .attr("y", 14)
                .text(key === 'checkouts' ? 'Checkouts' : 'Renewals')
                .style("font-size", "13px");
        });
        
        svg.append("text")
            .attr("class", "axis-label")
            .attr("text-anchor", "middle")
            .attr("transform", "rotate(-90)")
            .attr("x", -height / 2)
            .attr("y", -margin.left + 10)
            .text("Count");
    }

    
    let currentViz = "custom";
    function updateVisualization() {
        if (currentViz === "line") {
            trendModeDiv.style("display", null);
            if (trendMode === "yearly") {
                yearLabel.style("display", "none");
                monthLabel.style("display", null);
            } else {
                yearLabel.style("display", null);
                monthLabel.style("display", "none");
            }
        } else {
            trendModeDiv.style("display", "none");
            yearLabel.style("display", "none");
            monthLabel.style("display", "none");
        }
        if (currentViz === "custom") {
            metricLabel.style("display", null);
            groupbyLabel.style("display", null);
            d3.select("#branchLabel").style("display", null);
            drawCustomBarChart();
        } else {
            metricLabel.style("display", "none");
            groupbyLabel.style("display", "none");
        }
        if (currentViz === "heatmap") {
            heatmapValueLabel.style("display", null);
            heatmapRowLabel.style("display", null);
            heatmapColLabel.style("display", null);
            d3.select("#branchLabel").style("display", "none");
            drawHeatmap();
        } else {
            heatmapValueLabel.style("display", "none");
            heatmapRowLabel.style("display", "none");
            heatmapColLabel.style("display", "none");
            if (currentViz !== "custom") d3.select("#branchLabel").style("display", null);
        }
        const filtered = filterData();
        if (currentViz === "line") {
            drawLineChart(filtered);
        } else if (currentViz === "heatmap") {
            drawHeatmap();
        } else if (currentViz === "notice") {
            drawNoticeBarChart(filtered);
        } else if (currentViz === "patron") {
            drawPatronBarChart(filtered);
        }
    }

    
    d3.selectAll(".viz-btn").on("click", function() {
        d3.selectAll(".viz-btn").classed("active", false);
        d3.select(this).classed("active", true);
        currentViz = d3.select(this).attr("data-viz");
        updateVisualization();
    });

    
    branchFilter.on("change", updateVisualization);
    yearFilter.on("change", updateVisualization);
    monthFilter.on("change", updateVisualization);
    metricFilter.on("change", updateVisualization);
    groupbyFilter.on("change", updateVisualization);
    heatmapValueFilter.on("change", updateVisualization);
    heatmapRowFilter.on("change", updateVisualization);
    heatmapColFilter.on("change", updateVisualization);

    
    populateCustomDropdowns();
    populateHeatmapDropdowns();
    
    if (branchFilter.selectAll("option").size() > 0) {
        branchFilter.property("value", "");
    }
    
    if (metricFilter.selectAll("option").size() > 0 && groupbyFilter.selectAll("option").size() > 0) {
        updateVisualization();
    }
}); 
