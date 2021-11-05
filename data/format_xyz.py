from pathlib import Path
from itertools import compress
import re
import pandas as pd
import numpy as np

f = r"C:\Users\mat11012\OneDrive - Esri\Documents\Projects\sandia\NM_4210_contractor.xyz"

def format_xyz(f,bottom_inf=1000,lines_include=None):
    '''
    Reformats raw SkyTEM xyz file into a point cloud of resistivity estimates (X,Y,Z,rho,other attributes...)
    Input:
        f: file path to xyz file
        bottom_inf: max depth to represent infinite depth (meters)
        lines_include: list of line numbers to use as a filter before creating the point cloud
    Returns:
        DataFrame containing point cloud and attributes
    '''
    #Find the header column and remove the leading "/" and whitespace; make dataframe
    with open(f.as_posix(),'r') as file:
        data  = file.readlines()
    ind_header =  max([i for i,line in enumerate(data[:50]) if line.startswith('/') ])
    data[ind_header] = data[ind_header].strip('/').strip()
    cols = data[ind_header].split()
    data = data[ind_header+1:]
    if lines_include is not None:
        inline = [int(re.search('\s*[0-9]{6}\s+',d[:50]).group().strip()) in list(map(int, lines_include))   for d in data]
        data = list(compress(data,inline))
    data = [d.strip().split() for d in data]
    df= pd.DataFrame(data=data,columns=cols,dtype=float)

    #find the columns corresponding to x,y,z,interval bottom, interval thickness, resistivity: 
    cols_rho =  [c for c in cols if ('RHO' in c.upper()) and ('STD' not in c.upper())]
    cols_rho_std =  [c for c in cols if ('RHO' in c.upper()) and ('STD' in c.upper())]
    cols_bottom = [c for c in cols if ('BOT' in c.upper()) and ('STD' not in c.upper())]
    cols_thk = [c for c in cols if ('THK' in c.upper()) and ('STD' not in c.upper())]
    col_x = [c for c in cols[:20] if c.upper()=='X' or c.upper()=='UTMX'][0]
    col_y = [c for c in cols[:20] if c.upper()=='Y' or c.upper()=='UTMY'][0]
    col_elev = [c for c in cols[:20] if ('ELEV' in c.upper())][0]
    col_line = [c for c in cols[:20] if c.upper()=='LINE_NO'][0]
    cols_xyz_rho = [col_x,col_y,col_elev]
    cols_xyz_rho.extend(cols_rho)

    #slice the dataframe for necessary values; add extra layer into thickness and bottom to represent the infinite bottom layer
    bottom_inf_colname = 'DEP_BOT_INF'
    thk_inf_colname = 'THK_INF'
    bot = df.loc[0,cols_bottom].values
    thk = df.loc[0,cols_thk].values
    bots = df.loc[:,cols_bottom]
    thks = df.loc[:,cols_thk]
    bots[bottom_inf_colname] = np.ones(len(bots))*bottom_inf
    thks[thk_inf_colname] = np.ones(len(bots))*(bottom_inf - bot[-1])
    doi = np.tile(df.DOI_STANDARD.values,(len(bot)+1,1)).T
    lineno = np.tile(df.loc[:,col_line].values,(len(bot)+1,1)).T
    below_doi_m = bots - doi
    below_doi_m[below_doi_m<0]=0

    #format and return the dataframe
    return df.loc[:,cols_xyz_rho].melt(
        id_vars=[col_x,col_y,col_elev],value_vars=cols_rho,value_name='RHO').assign(
        INTERVAL_BOTTOM_DEPTH_m=bots.values.flatten(order='F')).assign(
        INTERVAL_THICKNESS_m=thks.values.flatten(order='F')).assign(
        INTERVAL_BOTTOM_ELEVATION_m=lambda x: x.loc[:,col_elev]-x.INTERVAL_BOTTOM_DEPTH_m).assign(
        LINE_NO=lineno.flatten(order='F')).assign(
        BELOW_DOI_m=below_doi_m.values.flatten(order='F')).drop(
        columns=['variable']).rename(
        columns={col_elev:'GROUND_ELEVATION_m',
                 col_x:'X',
                 col_y:'Y'})
